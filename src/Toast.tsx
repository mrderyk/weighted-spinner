import { useEffect } from "react";
type ToastProps = {
  open: boolean;
  message: string;
  onClose: () => void;
  duration?: number;
};
export function Toast({ open, message, onClose, duration = 2200 }: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: `translateX(-50%) ${
          open ? "translateY(0)" : "translateY(24px)"
        }`,
        opacity: open ? 1 : 0,
        transition: "all 260ms cubic-bezier(.2,.9,.2,1)",
        pointerEvents: "none",
        zIndex: 10000,
      }}
    >
      {" "}
      <div
        style={{
          background: "#242424",
          color: "#fff",
          padding: "12px 18px",
          borderRadius: 10,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(4px)",
        }}
      >
        {" "}
        {message}{" "}
      </div>{" "}
    </div>
  );
}
