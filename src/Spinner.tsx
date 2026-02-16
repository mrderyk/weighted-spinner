import { useEffect, useMemo, useRef, useState } from "react";

type WheelItem = { value: string; weight: number };

type WeightedWheelProps = {
  items: WheelItem[];
  size?: number; // CSS pixels
  onResult?: (value: string) => void;
};

function assertValid(items: WheelItem[]) {
  if (!Array.isArray(items) || items.length === 0)
    throw new Error("items must be a non-empty array");
  for (const it of items) {
    if (typeof it.value !== "string") throw new Error("value must be a string");
    if (
      typeof it.weight !== "number" ||
      !Number.isFinite(it.weight) ||
      it.weight < 0
    )
      throw new Error("weight must be a finite number >= 0");
  }
  const total = items.reduce((s, it) => s + it.weight, 0);
  if (total <= 0) throw new Error("total weight must be > 0");
}

function weightedPick(items: WheelItem[]): WheelItem {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function WeightedWheel({
  items,
  size = 420,
  onResult,
}: WeightedWheelProps) {
  // Render canvas at higher DPI for crispness
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string>("—");

  // Keep rotation in a ref so animation doesn't cause rerenders every frame
  const rotationRef = useRef<number>(0);

  const sliceCount = items.length;
  const sliceAngle = useMemo(
    () => (Math.PI * 2) / Math.max(1, sliceCount),
    [sliceCount]
  );

  useEffect(() => {
    assertValid(items);
  }, [items]);

  const drawWheel = (rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.45;

    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (let i = 0; i < items.length; i++) {
      const start = i * sliceAngle;
      const end = start + sliceAngle;

      // Slice fill (uniform light gray)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();

      ctx.fillStyle = "#e5e5e5";
      ctx.fill();

      // 🔹 Dotted divider
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1 / dpr;
      ctx.setLineDash([1 * dpr, 2 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label — lengthwise (radial)
      const mid = start + sliceAngle / 2;

      ctx.save();

      // Rotate to the middle of the slice
      ctx.rotate(mid);

      // Move outward from center
      ctx.translate(radius * 0.55, 0);

      // 🔑 Rotate so text runs from center → edge
      // (flip if on left side so text isn't upside down)
      if (mid > Math.PI / 2 && mid < (3 * Math.PI) / 2) {
        ctx.rotate(Math.PI); // keep upright on left half
      }

      // Draw text
      ctx.fillStyle = "#222";
      ctx.font = `300 ${Math.round(
        12 * dpr
      )}px "Segoe UI", Roboto, system-ui, sans-serif`;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // ctx.fillText(items[i].value.toUpperCase(), 0, 0);
      const text = items[i].value.toUpperCase(); // optional but looks premium

      // Center the spaced text
      const metrics = ctx.measureText(text);
      const totalWidth = metrics.width + (text.length - 1) * (1.5 * dpr); // spacing included

      fillTextWithLetterSpacing(
        ctx,
        text,
        -totalWidth / 2,
        0,
        1.5 * dpr // 🔥 adjust spacing here
      );

      ctx.restore();
    }

    // center cap
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = "#222"; // dark gray (less harsh than black)
    ctx.fill();

    ctx.restore();
  };

  // Initial draw + redraw if items/size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    drawWheel(rotationRef.current);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, size, dpr, sliceAngle]);

  const spin = () => {
    if (spinning) return;

    setSpinning(true);
    setResult("Spinning…");

    // 1) Pick winner by weight
    const winner = weightedPick(items);
    const index = items.findIndex((it) => it.value === winner.value);

    // 2) Random landing point inside that equal slice
    const margin = sliceAngle * 0.15;
    const landingAngle =
      index * sliceAngle + margin + Math.random() * (sliceAngle - margin * 2);

    const pointerAngle = -Math.PI / 2; // 12 o’clock
    const startRotation = rotationRef.current;

    const twoPi = Math.PI * 2;

    // 3) Smallest clockwise delta needed to align slice under pointer
    const raw = pointerAngle - landingAngle - startRotation;
    const neededDelta = ((raw % twoPi) + twoPi) % twoPi; // [0, 2π)

    // 4) Guarantee multiple full rotations (realistic spin)
    const minFullRotations = 2;
    const extraFullRotations = 2 + Math.floor(Math.random() * 4); // 2–5 more
    const fullRotations = minFullRotations + extraFullRotations; // 4–7 total

    const delta = fullRotations * twoPi + neededDelta;
    const targetRotation = startRotation + delta;

    // 5) Duration scaled to spin distance (SLOWER)
    const totalRotations = delta / twoPi;

    const msPerRotation = 1300; // 🔥 MAIN SPEED CONTROL
    const baseMs = 900;

    const durationMs =
      totalRotations * msPerRotation + baseMs + Math.random() * 400;

    const startTime = performance.now();

    function easeOutQuint(t: number) {
      return 1 - Math.pow(1 - t, 5);
    }

    const step = (now: number) => {
      const t = clamp01((now - startTime) / durationMs);
      const eased = easeOutQuint(t);

      const rot = startRotation + (targetRotation - startRotation) * eased;
      rotationRef.current = rot;
      drawWheel(rot);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setResult(`Result: ${winner.value}`);
        onResult?.(winner.value);
        setSpinning(false);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: size }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <canvas ref={canvasRef} />
        {/* Pointer */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: -6,
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "14px solid transparent",
            borderRight: "14px solid transparent",
            borderBottom: "24px solid #111",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={spin}
          disabled={spinning}
          style={{
            padding: "12px 22px",
            background: "#3a3a3a",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            cursor: spinning ? "default" : "pointer",

            // 🔤 Match wheel typography
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: "0.08em",
            textTransform: "uppercase",

            // subtle premium feel
            boxShadow: spinning ? "none" : "0 2px 6px rgba(0,0,0,0.25)",

            opacity: spinning ? 0.6 : 1,
            transition: "background 0.2s, box-shadow 0.2s, opacity 0.2s",
          }}
        >
          SPIN
        </button>
        <div style={{ fontWeight: 600 }}>{result}</div>
      </div>
    </div>
  );
}

function fillTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number // pixels (already scaled for dpr)
) {
  let currentX = x;

  for (const char of text) {
    ctx.fillText(char, currentX, y);
    currentX += ctx.measureText(char).width + spacing;
  }
}
