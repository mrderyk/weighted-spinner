import { useState } from "react";

type RevealModalProps = {
  open: boolean;
  value: string | null;
  owners: string | null;
  url: string | null;
  onClose: () => void;
  onRemove?: (value: string) => void; // 🔥 new
};

export function RevealModal({
  open,
  value,
  onClose,
  onRemove,
  url,
  owners,
}: RevealModalProps) {
  const [exiting, setExiting] = useState(false);

  // Keep mounted while exiting
  const visible = open || exiting;
  if (!visible) return null;

  const isClosing = exiting && !open;

  const requestClose = () => {
    if (!exiting) setExiting(true);
    onClose(); // parent flips open=false
  };

  console.log("### URL: ", url);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Selected value"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        padding: 16,
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") requestClose();
      }}
    >
      <div
        style={{
          position: "relative",
          top: "-40px",
          pointerEvents: "auto",
          width: "min(520px, 92vw)",
          background: "#242424",
          color: "#fff",
          borderRadius: 0,
          overflow: "hidden",

          // Wipe-in / wipe-out
          clipPath: "inset(0 0 0 0)",
          animation: `${
            isClosing ? "modal-wipe-out" : "modal-wipe-in"
          } 520ms cubic-bezier(0.2, 0.9, 0.2, 1) forwards`,
        }}
        tabIndex={-1}
        onAnimationEnd={(e) => {
          if (e.animationName === "modal-wipe-out") {
            // 🔥 animation finished — now remove item
            if (value != null) onRemove?.(value);

            // unmount modal
            setExiting(false);
          }
        }}
      >
        <button
          autoFocus
          onClick={requestClose}
          style={{
            position: "absolute",
            top: ".5rem",
            right: ".5rem",
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            fontSize: 18,
            cursor: "pointer",
            padding: 4,
            lineHeight: 1,
            borderRadius: "4px",
            border: "none",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>

        <div style={{ padding: "24px 18px 24px 18px" }}>
          <div
            style={{
              display: "inline-block",
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontFamily:
                  'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {url ? (
                <a target="_blank" href={url}>
                  {value ?? "—"}
                </a>
              ) : (
                value ?? "-"
              )}
            </div>
          </div>
          <div
            style={{
              marginTop: "8px",
              fontFamily:
                'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
              letterSpacing: "2px",
              fontSize: 10,
            }}
          >
            {owners?.toUpperCase() ?? ""}
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes modal-wipe-in {
            from { clip-path: inset(0 100% 0 0); }
            to   { clip-path: inset(0 0 0 0); }
          }

          @keyframes modal-wipe-out {
            from { clip-path: inset(0 0 0 0); }
            to   { clip-path: inset(0 100% 0 0); }
          }
        `}
      </style>
    </div>
  );
}
