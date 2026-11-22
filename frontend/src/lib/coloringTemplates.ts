export interface ColoringTemplate {
  key: string;
  label: string;
  emoji: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

function setupStroke(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "#24334D";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

export const TEMPLATES: ColoringTemplate[] = [
  {
    key: "blank",
    label: "Blank Canvas",
    emoji: "📄",
    draw: () => {
      // Pure white background only
    },
  },
  {
    key: "sun",
    label: "Happy Sun",
    emoji: "☀️",
    draw: (ctx, w, h) => {
      setupStroke(ctx);
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.22;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI * 2) / 10;
        const x1 = cx + Math.cos(angle) * (r + 18);
        const y1 = cy + Math.sin(angle) * (r + 18);
        const x2 = cx + Math.cos(angle) * (r + 64);
        const y2 = cy + Math.sin(angle) * (r + 64);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Friendly face inside sun
      ctx.beginPath();
      ctx.arc(cx - 32, cy - 16, 7, 0, Math.PI * 2);
      ctx.arc(cx + 32, cy - 16, 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy + 8, 34, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    },
  },
  {
    key: "house",
    label: "Cozy House",
    emoji: "🏠",
    draw: (ctx, w, h) => {
      setupStroke(ctx);
      const left = w * 0.28;
      const right = w * 0.72;
      const top = h * 0.42;
      const bottom = h * 0.82;
      const mid = w * 0.5;

      // Body
      ctx.strokeRect(left, top, right - left, bottom - top);

      // Roof
      ctx.beginPath();
      ctx.moveTo(left - 28, top);
      ctx.lineTo(mid, h * 0.16);
      ctx.lineTo(right + 28, top);
      ctx.closePath();
      ctx.stroke();

      // Door
      ctx.strokeRect(mid - 38, bottom - 120, 76, 120);
      ctx.beginPath();
      ctx.arc(mid + 20, bottom - 55, 6, 0, Math.PI * 2);
      ctx.stroke();

      // Windows
      ctx.strokeRect(left + 32, top + 40, 68, 68);
      ctx.strokeRect(right - 100, top + 40, 68, 68);
    },
  },
  {
    key: "flower",
    label: "Big Flower",
    emoji: "🌸",
    draw: (ctx, w, h) => {
      setupStroke(ctx);
      const cx = w / 2;
      const cy = h * 0.38;

      // Stem & Leaves
      ctx.beginPath();
      ctx.moveTo(cx, cy + 52);
      ctx.lineTo(cx, h * 0.88);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(cx - 56, h * 0.68, 46, 22, -0.4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(cx + 56, h * 0.74, 46, 22, 0.4, 0, Math.PI * 2);
      ctx.stroke();

      // 6 Petals
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6;
        const px = cx + Math.cos(angle) * 78;
        const py = cy + Math.sin(angle) * 78;
        ctx.beginPath();
        ctx.arc(px, py, 44, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Center circle
      ctx.beginPath();
      ctx.arc(cx, cy, 48, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.stroke();
    },
  },
];
