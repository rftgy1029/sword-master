"""Browser regression checks against a running production preview.

Requires Python Playwright and Chromium. Example:
  python scripts/check-story-motion.py --chromium /usr/bin/chromium
"""
import argparse
import json
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8176')
parser.add_argument('--chromium')
args = parser.parse_args()
errors = []
checks = []


def open_line(page, scene, index, motion='normal'):
    page.goto(args.url)
    page.evaluate('''([scene, index, motion]) => {
      localStorage.clear();
      localStorage.setItem('sword-master.story-progress.v1', JSON.stringify({version:1,progress:{
        tier:'bronze',storyId:'bronze-chapter-01-v3',sceneId:scene,lineIndex:index,completed:false
      }}));
      localStorage.setItem('sword-master.settings.v1', JSON.stringify({version:1,settings:{
        backgroundMotion:motion,soundEffects:'off',selectionEffect:'static'
      }}));
    }''', [scene, index, motion])
    page.reload()
    page.locator('.menu-button.continue-button').click()
    expect(page.locator('.story-art')).to_be_visible()
    page.get_by_role('combobox', name='이야기 재생 속도').select_option('0.75')


def capture(page, selector, name):
    page.locator(selector).first.evaluate('''(element, name) => {
      const animation = element.getAnimations().find(a => a.animationName === name);
      if (!animation) throw Error(`Missing animation: ${name}`);
      window.motionCheck = {element, animation};
    }''', name)
    iterations = page.evaluate('motionCheck.animation.effect.getTiming().iterations')
    assert iterations == 1, (selector, name, iterations)


def finish(page):
    page.evaluate('motionCheck.animation.finish()')


def same_animation(page, selector, finished=False):
    assert page.locator(selector).first.evaluate('e => e === motionCheck.element'), selector
    assert page.evaluate('motionCheck.element.getAnimations().includes(motionCheck.animation)'), selector
    if finished:
        assert page.evaluate('motionCheck.animation.playState') == 'finished', selector


def pause_resume(page, selector):
    page.get_by_role('button', name='자동 진행 중 · 일시정지', exact=False).click()
    same_animation(page, selector)
    assert page.evaluate('motionCheck.animation.playState') == 'paused'
    page.evaluate('motionCheck.animation.currentTime = 350')
    page.wait_for_timeout(150)
    assert page.evaluate('motionCheck.animation.currentTime') == 350
    page.get_by_role('button', name='자동 진행 재생', exact=True).click()
    same_animation(page, selector)
    page.wait_for_timeout(80)
    assert page.evaluate('motionCheck.animation.currentTime') > 350


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=args.chromium, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

    for scene, index, selector, name in [
        ('S02', 1, '.actor-nia', 'nia-greet'),
        ('S02', 11, '.actor-nia', 'actor-speak'),
        ('S03', 23, '.actor-momo', 'momo-jump'),
        ('S03', 32, '.actor-momo', 'momo-jump'),
    ]:
        open_line(page, scene, index)
        capture(page, selector, name)
        finish(page)
        page.wait_for_timeout(80)
        same_animation(page, selector, finished=True)
        checks.append(f'{scene}:{index} {name}: once')

    open_line(page, 'S03', 23)
    page.locator('.actor-momo').evaluate('''e => {
      window.motionEvents = {iterations:0, ends:0};
      e.addEventListener('animationiteration', () => motionEvents.iterations++);
      e.addEventListener('animationend', () => motionEvents.ends++);
    }''')
    page.wait_for_timeout(1900)
    assert page.evaluate('motionEvents') == {'iterations': 0, 'ends': 1}
    checks.append('one spoken line: one completed jump, zero repeated iterations')

    open_line(page, 'S03', 0)
    capture(page, '.actor-momo', 'momo-chase')
    finish(page)
    for _ in range(3):
        page.locator('.story-reader-controls .story-next-button').click()
        same_animation(page, '.actor-momo', finished=True)
    checks.append('chase stays complete across four lines, including repeated/absent cues')

    open_line(page, 'S04', 35)
    capture(page, '.actor-nia', 'festival-leave')
    finish(page)
    for _ in range(2):
        page.locator('.story-reader-controls .story-next-button').click()
        same_animation(page, '.actor-nia', finished=True)
    checks.append('Nia leaves once across three lines')

    open_line(page, 'S01', 5)
    capture(page, '.corridor-entering', 'corridor-arrive')
    pause_resume(page, '.corridor-entering')
    finish(page)
    page.get_by_role('button', name='자동 진행 중 · 일시정지', exact=False).click()
    page.get_by_role('button', name='자동 진행 재생', exact=True).click()
    same_animation(page, '.corridor-entering', finished=True)
    checks.append('corridor pause/resume preserves position and finished motion')

    open_line(page, 'S04', 35)
    capture(page, '.actor-nia', 'festival-leave')
    pause_resume(page, '.actor-nia')
    page.get_by_role('button', name=re.compile('장면 목록')).click()
    same_animation(page, '.actor-nia')
    assert page.evaluate('motionCheck.animation.playState') == 'paused'
    page.locator('#story-contents').get_by_role('button', name='닫기 ×', exact=True).click()
    same_animation(page, '.actor-nia')
    page.evaluate('''() => {
      Object.defineProperty(document, 'hidden', {configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
    }''')
    expect(page.locator('.story-art')).to_have_attribute('data-paused', 'true')
    same_animation(page, '.actor-nia')
    page.evaluate('motionCheck.animation.currentTime = 600')
    page.wait_for_timeout(150)
    assert page.evaluate('motionCheck.animation.currentTime') == 600
    page.evaluate('''() => {
      Object.defineProperty(document, 'hidden', {configurable:true,value:false});
      document.dispatchEvent(new Event('visibilitychange'));
    }''')
    expect(page.locator('.story-art')).to_have_attribute('data-paused', 'false')
    same_animation(page, '.actor-nia')
    assert page.evaluate('motionCheck.animation.currentTime') >= 600
    checks.append('contents and hidden-tab pauses preserve the same animation')

    # Keeping actors alive must still allow a new attack for each real answer.
    words = json.loads((Path(__file__).resolve().parents[1] / 'src/data/vocabulary.json').read_text())
    rescue_words = [word for word in words if word['tier'] == 'bronze'][4:10]
    open_line(page, 'S03', 16)
    page.get_by_role('button', name='자동 진행 중 · 일시정지', exact=False).click()
    for index, word in enumerate(rescue_words):
        options = page.locator('.battle-options button')
        if index == 2:
            options.filter(has_not_text=word['meaning']).first.click()
        else:
            options.filter(has_text=word['meaning']).click()
        action = 'guard' if index == 2 else 'slash'
        expect(page.locator('.story-art')).to_have_class(re.compile(rf'action-{action}'))
        capture(page, '.actor-hero', 'hero-guard' if index == 2 else 'hero-strike')
        finish(page)
        page.get_by_role('button', name=re.compile('^(다음 문제|결과 보기) →$')).click()
    expect(page.locator('.battle-result')).to_be_visible()
    expect(page.locator('.story-art')).to_have_class(re.compile('action-victory'))
    capture(page, '.actor-momo', 'momo-jump')
    finish(page)
    same_animation(page, '.actor-momo', finished=True)
    saved = page.evaluate("JSON.parse(localStorage.getItem('sword-master.bronze-learning.v1'))")
    assert len(saved['history']) == 6
    assert saved['economy']['coins'] == 45
    checks.append('six answers each animate once; victory jumps once; answers and reward unchanged')

    mobile = browser.new_page(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    mobile.on('pageerror', lambda e: errors.append(str(e)))
    open_line(mobile, 'S03', 32)
    capture(mobile, '.actor-momo', 'momo-jump')
    finish(mobile)
    mobile.locator('.story-reader-controls .story-next-button').tap()
    same_animation(mobile, '.actor-momo', finished=True)
    assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth')
    for mode in ['reduced', 'off']:
        open_line(mobile, 'S03', 23, motion=mode)
        assert mobile.locator('.actor-momo').evaluate('e => e.getAnimations().length') == 0
    mobile.emulate_media(reduced_motion='reduce')
    open_line(mobile, 'S02', 1)
    assert mobile.locator('.actor-nia').evaluate('e => e.getAnimations().length') == 0
    checks.append('mobile touch and all reduced-motion modes')

    assert errors == [], errors
    print(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False))
    browser.close()
