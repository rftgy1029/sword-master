"""Generate the original monochrome combat flipbook and slash mask."""
import math
from pathlib import Path
from PIL import Image

SIZE = 64
FRAMES = 8
DESTINATION = Path(__file__).resolve().parents[1] / "public" / "effects"


def smooth(lo, hi, value):
    t = min(1.0, max(0.0, (value - lo) / (hi - lo)))
    return t * t * (3 - 2 * t)


def alpha(row, frame, x, y):
    time = frame / (FRAMES - 1)
    radius, angle = math.hypot(x, y), math.atan2(y, x)
    noise = math.sin(9 * angle + radius * 13) * math.sin(13 * angle - radius * 7)
    if row == 0:
        # An expanding flash front, with bright rays following its core.
        outer = .26 + time * .58 + noise * .11
        shell = math.exp(-((radius - outer) / (.16 + time * .08)) ** 2)
        rays = max(0, math.cos(angle * 7)) ** 8 * (1 - smooth(.12, .95, radius))
        core = (1 - smooth(0, max(.1, .51 - .31 * time), radius)) * .95
        return (core + shell * (.7 - .38 * time) + rays * .8) * (1 - .77 * time)
    # Smoke pockets drift apart while the central plume thins.
    radius += .11 * math.sin(angle * 6 + radius * 12) + .075 * noise
    soft = (1 - smooth(.14 + .27 * time, .48 + .45 * time, radius))
    grain = .68 + .21 * math.cos(x * 16 + math.sin(y * 8)) * math.cos(y * 20 - x * 7)
    return soft * grain * (1 - .75 * time)


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (SIZE * FRAMES, SIZE * 2))
    for row in range(2):
        for frame in range(FRAMES):
            for j in range(SIZE):
                for i in range(SIZE):
                    x, y = (i + .5) / SIZE * 2 - 1, (j + .5) / SIZE * 2 - 1
                    value = alpha(row, frame, x, y)
                    atlas.putpixel((frame * SIZE + i, row * SIZE + j), (255, 255, 255, round(255 * min(1, value))))
    atlas.save(DESTINATION / "impact-flipbook.png", optimize=True)

    mask = Image.new("RGBA", (128, 32))
    for j in range(mask.height):
        for i in range(mask.width):
            u, v = (i + .5) / mask.width, 1 - (j + .5) / mask.height
            sweep = math.sin(u * math.pi) ** .38
            profile = smooth(0, .48, v) * (1 - smooth(.84, 1, v))
            streaks = .82 + .18 * math.cos(v * 39 + u * 14)
            mask.putpixel((i, j), (255, 255, 255, round(255 * sweep * profile * streaks)))
    mask.save(DESTINATION / "sword-light.png", optimize=True)


if __name__ == "__main__":
    main()
