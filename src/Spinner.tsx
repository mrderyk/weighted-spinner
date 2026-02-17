import { useEffect, useMemo, useRef, useState } from "react";
import type { EntryRow } from "./utils";
import { handleSave } from "./utils";
import { Toast } from "./Toast";

type WheelItem = { value: string; weight: number };

type WeightedWheelProps = {
  items: WheelItem[];
  size?: number; // CSS pixels
  onResult?: (value: string) => void;
  onRemove?: (value: string) => void;
  onReset?: () => void;
  isDisabled?: boolean;
  rowsToSave: EntryRow[];

  // 🔥 when true, wheel plays pop animation for the last-selected item,
  // then calls onRemove(value) AFTER the pop completes.
  removeSelectedRequested?: boolean;
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

function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}

type AngleRange = { start: number; end: number };
const keyOf = (it: WheelItem) => it.value; // assumes values unique; add id if not

function buildEqualRanges(list: WheelItem[]) {
  const n = Math.max(1, list.length);
  const slice = (Math.PI * 2) / n;
  const map = new Map<string, AngleRange>();
  for (let i = 0; i < list.length; i++) {
    map.set(keyOf(list[i]), { start: i * slice, end: (i + 1) * slice });
  }
  return map;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function WeightedWheel({
  items,
  size = 420,
  onResult,
  onRemove,
  onReset,
  isDisabled,
  removeSelectedRequested,
  rowsToSave,
}: WeightedWheelProps) {
  const rowsToSaveRef = useRef<EntryRow[]>(rowsToSave);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null); // spin + pop
  const reflowRafRef = useRef<number | null>(null); // layout transition

  const [spinning, setSpinning] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  // Track last-selected index so we can remove it later
  const selectedIndexRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);

  const sliceCount = items.length;
  const sliceAngle = useMemo(
    () => (Math.PI * 2) / Math.max(1, sliceCount),
    [sliceCount]
  );

  // Smooth reflow support
  const prevItemsRef = useRef<WheelItem[]>(items);
  const activeRangesRef = useRef<Map<string, AngleRange>>(
    buildEqualRanges(items)
  );

  useEffect(() => {
    assertValid(items);

    if (
      selectedIndexRef.current != null &&
      selectedIndexRef.current >= items.length
    ) {
      selectedIndexRef.current = null;
    }
  }, [items]);

  const drawWheel = (
    rotation: number,
    opts?: { popIndex?: number; popProgress?: number }
  ) => {
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

    const popIndex = opts?.popIndex ?? -1;
    const p = opts?.popProgress ?? 0;

    const ranges = activeRangesRef.current;

    for (let i = 0; i < items.length; i++) {
      const r = ranges.get(keyOf(items[i]));
      if (!r) continue;

      const start = r.start;
      const end = r.end;
      const mid = (start + end) / 2;

      const isPopping = i === popIndex;

      // Pop-out + fade + glow
      const popOffset = isPopping ? radius * 0.18 * p : 0;
      const popScale = isPopping ? 1 + 0.08 * p : 1;
      const alpha = isPopping ? 1 - 0.9 * p : 1;

      ctx.save();

      if (isPopping) {
        ctx.translate(Math.cos(mid) * popOffset, Math.sin(mid) * popOffset);
        ctx.scale(popScale, popScale);
        ctx.shadowColor = "rgba(255,255,255,0.85)";
        ctx.shadowBlur = 18 * dpr * p;
      }

      ctx.globalAlpha = alpha;

      // Slice fill
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();

      ctx.fillStyle = "#e5e5e5";
      ctx.fill();

      // Dotted divider
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1 / dpr;
      ctx.setLineDash([1 * dpr, 2 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label — lengthwise (radial)
      ctx.save();

      ctx.rotate(mid);
      ctx.translate(radius * 0.55, 0);

      if (mid > Math.PI / 2 && mid < (3 * Math.PI) / 2) {
        ctx.rotate(Math.PI);
      }

      ctx.fillStyle = "#222";
      ctx.font = `300 ${Math.round(
        12 * dpr
      )}px "Segoe UI", Roboto, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const text = items[i].value.toUpperCase();
      const metrics = ctx.measureText(text);
      const spacing = 1.5 * dpr;
      const totalWidth = metrics.width + (text.length - 1) * spacing;
      fillTextWithLetterSpacing(ctx, text, -totalWidth / 2, 0, spacing);

      ctx.restore();

      // Optional “spark” lines near end of pop
      if (isPopping && p > 0.35) {
        const sparkP = (p - 0.35) / 0.65;
        const sparkCount = 10;
        ctx.save();
        ctx.globalAlpha = 0.35 * (1 - sparkP);
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2 / dpr;
        for (let k = 0; k < sparkCount; k++) {
          const a = mid + (k - sparkCount / 2) * 0.06;
          const r1 = radius * (0.92 + 0.03 * sparkP);
          const r2 = radius * (1.02 + 0.08 * sparkP);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // center dot
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = "#222";
    ctx.fill();

    ctx.restore();
  };

  // Initial sizing + draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    activeRangesRef.current = buildEqualRanges(items);
    drawWheel(rotationRef.current);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (reflowRafRef.current != null)
        cancelAnimationFrame(reflowRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, dpr]);

  // Elegant gap-closing reflow animation when items change count
  useEffect(() => {
    const prev = prevItemsRef.current;
    const next = items;

    const to = buildEqualRanges(next);

    if (prev.length !== next.length && prev.length > 1 && next.length > 0) {
      const from = buildEqualRanges(prev);

      const durationMs = 420;
      const startTime = performance.now();

      const step = (now: number) => {
        const t = clamp01((now - startTime) / durationMs);
        const eased = easeOutQuint(t);

        const blended = new Map<string, AngleRange>();

        for (const it of next) {
          const k = keyOf(it);
          const a = from.get(k);
          const b = to.get(k);
          if (!b) continue;

          blended.set(
            k,
            a
              ? {
                  start: lerp(a.start, b.start, eased),
                  end: lerp(a.end, b.end, eased),
                }
              : b
          );
        }

        activeRangesRef.current = blended;
        drawWheel(rotationRef.current);

        if (t < 1) {
          reflowRafRef.current = requestAnimationFrame(step);
        } else {
          activeRangesRef.current = to;
          drawWheel(rotationRef.current);
        }
      };

      if (reflowRafRef.current != null)
        cancelAnimationFrame(reflowRafRef.current);
      reflowRafRef.current = requestAnimationFrame(step);
    } else {
      activeRangesRef.current = to;
      drawWheel(rotationRef.current);
    }

    prevItemsRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const spin = () => {
    if (spinning || isDisabled) return;
    if (items.length === 0) return;

    setSpinning(true);

    const winner = weightedPick(items);
    const index = items.findIndex((it) => it.value === winner.value);

    const margin = sliceAngle * 0.15;
    const landingAngle =
      index * sliceAngle + margin + Math.random() * (sliceAngle - margin * 2);

    const pointerAngle = -Math.PI / 2;
    const startRotation = rotationRef.current;
    const twoPi = Math.PI * 2;

    const raw = pointerAngle - landingAngle - startRotation;
    const neededDelta = ((raw % twoPi) + twoPi) % twoPi;

    const minFullRotations = 2;
    const extraFullRotations = 2 + Math.floor(Math.random() * 4);
    const fullRotations = minFullRotations + extraFullRotations;

    const delta = fullRotations * twoPi + neededDelta;
    const targetRotation = startRotation + delta;

    const totalRotations = delta / twoPi;
    const msPerRotation = 1300;
    const baseMs = 900;
    const durationMs =
      totalRotations * msPerRotation + baseMs + Math.random() * 400;

    const startTime = performance.now();

    const step = (now: number) => {
      const t = clamp01((now - startTime) / durationMs);
      const eased = easeOutQuint(t);

      const rot = startRotation + (targetRotation - startRotation) * eased;
      rotationRef.current = rot;
      drawWheel(rot);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        selectedIndexRef.current = index;
        onResult?.(winner.value);
        setSpinning(false);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  // ✅ Pop + remove animation (called when removeSelectedRequested flips true)
  const removingRef = useRef(false);
  const lastRemoveReqRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    // only respond to rising edge
    if (!removeSelectedRequested) {
      lastRemoveReqRef.current = removeSelectedRequested;
      return;
    }
    if (lastRemoveReqRef.current === true) return;
    lastRemoveReqRef.current = true;

    if (spinning || isDisabled) return;
    if (removingRef.current) return;

    const idx = selectedIndexRef.current;
    if (idx == null || idx < 0 || idx >= items.length) return;

    const valueToRemove = items[idx].value;
    const startRotation = rotationRef.current;
    const durationMs = 520;
    const startTime = performance.now();

    removingRef.current = true;

    const step = (now: number) => {
      const t = clamp01((now - startTime) / durationMs);
      const eased = easeOutQuint(t);

      drawWheel(startRotation, { popIndex: idx, popProgress: eased });

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        removingRef.current = false;
        selectedIndexRef.current = null;

        onRemove?.(valueToRemove);
        drawWheel(rotationRef.current);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeSelectedRequested]);

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: size }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <canvas ref={canvasRef} />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: -6,
            transform: "translateX(-50%) translateY(16px)",
            width: 0,
            height: 0,
            borderLeft: "18px solid transparent",
            borderRight: "18px solid transparent",
            borderTop: "24px solid #242424",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          onClick={spin}
          disabled={spinning || isDisabled}
          style={{
            padding: "12px 22px",
            background: "#3a3a3a",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            cursor: spinning || isDisabled ? "default" : "pointer",
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: spinning ? "none" : "0 2px 6px rgba(0,0,0,0.25)",
            opacity: spinning || isDisabled ? 0.6 : 1,
            transition: "background 0.2s, box-shadow 0.2s, opacity 0.2s",
          }}
        >
          SPIN
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
        <button
          type="button"
          disabled={spinning || isDisabled}
          onClick={() => onReset?.()}
          style={{
            padding: "4px 6px 4px 6px",
            background: "transparent",
            color: "#ffffff",

            borderRadius: 8,
            cursor: spinning || isDisabled ? "default" : "pointer",
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
            fontWeight: 600,
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: spinning || isDisabled ? 0.6 : 1,
          }}
        >
          RESET
        </button>
        <button
          type="button"
          disabled={spinning || isDisabled}
          onClick={async () => {
            handleSave(rowsToSaveRef.current);
            await navigator.clipboard.writeText(window.location.href);
            setToastOpen(true);
          }}
          style={{
            padding: "4px 6px 4px 6px",
            background: "transparent",
            color: "#ffffff",

            borderRadius: 8,
            cursor: spinning || isDisabled ? "default" : "pointer",
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
            fontWeight: 600,
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: spinning || isDisabled ? 0.6 : 1,
          }}
        >
          COPY LINK
        </button>
      </div>
      <Toast
        open={toastOpen}
        message="Link copied to clipboard"
        onClose={() => setToastOpen(false)}
      />
    </div>
  );
}

function fillTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number
) {
  let currentX = x;
  for (const char of text) {
    ctx.fillText(char, currentX, y);
    currentX += ctx.measureText(char).width + spacing;
  }
}
