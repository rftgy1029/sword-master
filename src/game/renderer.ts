import type { BattleState, Fighter, Stage } from '../types.ts';
import { rules } from './rules.ts';

// Canvas drawing is isolated from gameplay and DOM controls.
export function createRenderer(ctx: CanvasRenderingContext2D) {
  let g: BattleState;
  let stage: Stage;
  let stageIndex = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function line(x1: number, y1: number, x2: number, y2: number, color: string, width = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function ellipse(x: number, y: number, rx: number, ry: number, color: string, stroke?: string) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  function text(label: string, x: number, y: number, size: number, color?: string) {
    ctx.fillStyle = color || "#294537";
    ctx.font = "700 " + size + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y);
  }

  function hill(x: number, y: number, w: number, h: number, color: string) {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - h, x + w, y);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function bar(x: number, y: number, width: number, ratio: number, color: string) {
    ctx.fillStyle = "#d7dfd0";
    ctx.fillRect(x, y, width, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, ratio)), 6);
  }

  function drawBase(x: number, own: boolean) {
    const ink = "#384d40";
    const fill = own ? "#fffaf0" : "#6a7480";

    ctx.fillStyle = own ? "#dbe6cb" : "#cbd0d3";
    ctx.fillRect(x - 35, 217, 70, 70);

    ctx.fillStyle = fill;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(x - 38, 219);
    ctx.lineTo(x - 38, 179);
    ctx.lineTo(x - 20, 193);
    ctx.quadraticCurveTo(x, 177, x + 20, 193);
    ctx.lineTo(x + 38, 179);
    ctx.lineTo(x + 38, 219);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = fill;
    ctx.fillRect(x - 38, 214, 76, 68);
    ctx.strokeRect(x - 38, 214, 76, 68);

    ellipse(x - 14, 213, 3.4, 4.5, own ? ink : "#fff");
    ellipse(x + 14, 213, 3.4, 4.5, own ? ink : "#fff");

    ctx.fillStyle = own ? "#89a17c" : "#404b57";
    ctx.fillRect(x - 13, 247, 26, 35);

    line(x + 25, 178, x + 25, 139, ink, 3);

    ctx.beginPath();
    ctx.moveTo(x + 25, 139);
    ctx.lineTo(x + 58, 148);
    ctx.lineTo(x + 25, 159);
    ctx.fillStyle = own ? "#e7a557" : "#8e779f";
    ctx.fill();

    text(own ? "우리 기지" : "먹구름 기지", x, 113, 16, ink);
    bar(
      x - 43, 125, 86,
      own ? g.ownHP / rules.ownBaseHP : g.enemyHP / stage.hp,
      own ? "#528c61" : "#8b759f"
    );
  }

  function drawUnit(u: Fighter) {
    const x = u.x;
    const bob = reduced ? 0 : Math.sin(g.time * 8 + u.phase) * 2;
    const y = 271 + bob;
    const ink = "#344d3c";

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(u.side === 1 ? 1 : -1, 1);

    ellipse(0, 12, u.r + 3, 4, "#23372b15");

    if (u.side === 1) {
      const color = u.hit > 0
        ? "#f6c28e"
        : u.type === 1 ? "#eadfc7" : "#fffdf3";

      line(-8, 3, -10, 12, ink, 3);
      line(8, 3, 12, 12, ink, 3);
      ellipse(0, -10, u.r * .8, u.r, color, ink);

      ctx.beginPath();
      ctx.moveTo(-u.r, -u.r - 8);
      ctx.lineTo(-u.r + 1, -u.r - 24);
      ctx.lineTo(-5, -u.r - 14);
      ctx.quadraticCurveTo(0, -u.r - 17, 7, -u.r - 14);
      ctx.lineTo(u.r - 1, -u.r - 24);
      ctx.lineTo(u.r, -u.r - 8);
      ctx.quadraticCurveTo(u.r + 6, 4, 0, 2);
      ctx.quadraticCurveTo(-u.r - 6, 4, -u.r, -u.r - 8);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ellipse(-7, -u.r - 3, 2, 3, ink);
      ellipse(7, -u.r - 3, 2, 3, ink);
      line(-2, -u.r + 5, 0, -u.r + 7, ink, 1.5);
      line(0, -u.r + 7, 3, -u.r + 4, ink, 1.5);

      if (u.type === 1) {
        ellipse(20, -6, 11, 16, "#82a990", ink);
        text("+", 20, -1, 17, "#fff");
      }

      if (u.type === 2) {
        ctx.beginPath();
        ctx.moveTo(-20, -u.r - 16);
        ctx.lineTo(0, -u.r - 50);
        ctx.lineTo(19, -u.r - 16);
        ctx.fillStyle = "#8796be";
        ctx.fill();
        ctx.stroke();

        line(22, 6, 28, -36, "#98704b", 3);
        text("✦", 28, -36, 20, "#d79a41");
      }
    } else {
      const colors = ["#9f94b9", "#a7b4be", "#b393a3"];
      ellipse(
        0, -u.r, u.r, u.r,
        u.hit > 0 ? "#f2b6a5" : colors[u.type],
        ink
      );

      ctx.beginPath();
      ctx.moveTo(-u.r + 2, -u.r - 9);
      ctx.lineTo(-u.r + 3, -u.r - 23);
      ctx.lineTo(-4, -u.r - 15);
      ctx.fillStyle = colors[u.type];
      ctx.fill();
      ctx.stroke();

      ellipse(-6, -u.r - 3, 2, 3, "#fff");
      ellipse(6, -u.r - 3, 2, 3, "#fff");
      line(-4, -u.r + 7, 4, -u.r + 7, ink, 2);
    }

    ctx.restore();

    bar(
      x - 18, y - u.r * 2 - 27, 36,
      u.hp / u.maxHP,
      u.side === 1 ? "#5b946d" : "#aa7f9c"
    );
  }

  function draw() {
    const s = stage;

    ctx.clearRect(0, 0, 1000, 370);
    ctx.fillStyle = s.sky;
    ctx.fillRect(0, 0, 1000, 370);

    ellipse(780, 65, 30, 30, stageIndex === 2 ? "#fffbdf" : "#f6d38b");

    hill(140, 230, 230, 135, "#d7e4cd");
    hill(490, 240, 320, 160, stageIndex === 1 ? "#e0d9bc" : "#dce7d2");
    hill(850, 240, 290, 100, "#cbdcc2");

    ctx.fillStyle = "#bdcfa9";
    ctx.fillRect(0, 281, 1000, 89);
    ctx.fillStyle = "#dce3c7";
    ctx.fillRect(0, 291, 1000, 79);

    for (let i = 0; i < 26; i++) {
      const x = (i * 137) % 1000;
      const y = 310 + (i * 29) % 50;
      line(x, y, x + 7, y - 3, "#a7b990", 2);
    }

    line(0, 283, 1000, 283, "#9db38a", 3);
    drawBase(70, true);
    drawBase(930, false);

    if (!g.units.length) {
      text(
        g.mode === "intro"
          ? "단어를 맞히고 첫 부대를 소환해보세요."
          : "고양이 부대를 소환하세요!",
        500, 200, 19, "#71816d"
      );
    }

    g.units.slice().sort((a, b) => a.x - b.x).forEach(drawUnit);

    g.fx.forEach(f => {
      ctx.save();
      ctx.globalAlpha = f.life / f.max;

      if (f.beam) {
        line(f.x, f.y - 20, f.tx, f.y - 20, "#a991d0", 4);
      } else {
        text(
          f.text, f.x,
          f.y - (reduced ? 0 : (f.max - f.life) * 35),
          17, f.color
        );
      }

      ctx.restore();
    });

    text("CAT CAMP", 70, 333, 12, "#687c60");
    text("WORD FRONTIER", 500, 344, 11, "#869578");
    text("CLOUD CAMP", 930, 333, 12, "#687c60");
  }


  return {
    draw(state: BattleState, stageInfo: Stage, index: number) {
      g = state;
      stage = stageInfo;
      stageIndex = index;
      draw();
    },
  };
}
