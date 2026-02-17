import { useMemo, useState } from "react";
import "./App.css";
import { WeightedWheel } from "./Spinner";
import { RevealModal } from "./RevealModal";
import { decodeRowsFromLocation, type EntryRow } from "./utils";

function App() {
  const removeRow = (index: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev; // keep at least one row
      return prev.filter((_, i) => i !== index);
    });
  };

  const makeRow = (): EntryRow => ({
    id: "",
    url: "",
    usernames: "",
    weight: "1",
  });

  const [rows, setRows] = useState<EntryRow[]>(() => {
    const decoded = decodeRowsFromLocation();
    return decoded?.length ? decoded : [makeRow()];
  });

  const [step, setStep] = useState<"form" | "spinner">("form");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  // 🔥 triggers wheel pop animation after modal wipes out
  const [removeRequested, setRemoveRequested] = useState(false);

  // Items for spinner from ALL onscreen rows
  const spinnerItems = useMemo(() => {
    return rows.map((r, idx) => {
      const idTrimmed = r.id.trim();
      const value = idTrimmed.length > 0 ? idTrimmed : `ROW-${idx + 1}`;

      const w = Number(r.weight);
      const weight = Number.isFinite(w) && w > 0 ? w : 0;

      return { value, weight };
    });
  }, [rows]);

  const nextDisabled = !rows.some((r) => {
    const w = Number(r.weight);
    return !!r.id && Number.isFinite(w) && w > 0;
  });

  const updateRow = (index: number, patch: Partial<EntryRow>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  const addMore = () => setRows((prev) => [...prev, makeRow()]);

  const removeBySpinnerValue = (value: string) => {
    setRows((prev) => {
      // 1) Try match by exact ID string (trimmed)
      const idxById = prev.findIndex((r) => r.id.trim() === value);
      if (idxById !== -1) return prev.filter((_, i) => i !== idxById);

      // 2) If it was a placeholder like ROW-3, remove that row index
      const m = /^ROW-(\d+)$/.exec(value);
      if (m) {
        const rowIndex = Number(m[1]) - 1;
        if (rowIndex >= 0 && rowIndex < prev.length) {
          return prev.filter((_, i) => i !== rowIndex);
        }
      }

      return prev; // nothing matched
    });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.14)",
    outline: "none",
    background: "#fff",
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    fontSize: 14,
    letterSpacing: "0.01em",
    color: "#333",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#eee",
    marginBottom: 6,
    fontWeight: 400,
  };

  const buttonStyle: React.CSSProperties = {
    padding: "12px 22px",
    background: "#3a3a3a",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    boxShadow: "none",
  };

  const rowGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "160px 1.4fr 1.2fr 140px 40px",
    columnGap: 8, // ✅ required
  };

  return (
    <>
      {step === "form" ? (
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: 16,
            display: "grid",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 10,
              padding: 14,
              borderRadius: 12,
              background: "rgba(0,0,0,0.03)",
            }}
          >
            <div style={rowGridStyle}>
              <div style={labelStyle}>ID</div>
              <div style={labelStyle}>URL</div>
              <div style={labelStyle}>Usernames</div>
              <div style={labelStyle}>Weight</div>
              <div></div>
            </div>

            {rows.map((r, i) => (
              <div key={i} style={rowGridStyle}>
                <input
                  className="no-spinner"
                  style={inputStyle}
                  placeholder="ID"
                  value={r.id}
                  onChange={(e) => updateRow(i, { id: e.target.value })}
                />

                <input
                  style={inputStyle}
                  type="url"
                  placeholder="https://example.com"
                  value={r.url}
                  onChange={(e) => updateRow(i, { url: e.target.value })}
                />

                <input
                  style={inputStyle}
                  type="text"
                  placeholder="alice, bob, charlie"
                  value={r.usernames}
                  onChange={(e) => updateRow(i, { usernames: e.target.value })}
                />

                <input
                  className="no-spinner"
                  style={inputStyle}
                  inputMode="numeric"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="1"
                  value={r.weight}
                  onChange={(e) => updateRow(i, { weight: e.target.value })}
                />

                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 1}
                  style={{
                    background: "#3a3a3a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    cursor: rows.length <= 1 ? "default" : "pointer",

                    fontFamily:
                      'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
                    fontWeight: 600,
                    fontSize: 12,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",

                    opacity: rows.length <= 1 ? 0.4 : 1,
                  }}
                >
                  X
                </button>
              </div>
            ))}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 6,
                paddingRight: "48px",
              }}
            >
              <button type="button" onClick={addMore} style={buttonStyle}>
                Add more
              </button>

              <button
                type="button"
                onClick={() => setStep("spinner")}
                disabled={nextDisabled}
                style={{
                  ...buttonStyle,
                  opacity: nextDisabled ? 0.6 : 1,
                  cursor: nextDisabled ? "default" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <WeightedWheel
            onReset={() => {
              setStep("form");
              setRows([makeRow()]);
            }}
            isDisabled={modalOpen}
            items={spinnerItems}
            rowsToSave={rows}
            onResult={(value) => {
              setSelectedValue(value);
              setModalOpen(true);
            }}
            onRemove={(value) => {
              // called AFTER wheel pop animation completes
              console.log("### REMOVE");
              removeBySpinnerValue(value);

              // reset request flag so it can be triggered again later
              setRemoveRequested(false);
            }}
            removeSelectedRequested={removeRequested}
          />

          <RevealModal
            open={modalOpen}
            value={selectedValue}
            url={
              selectedValue
                ? rows.find((r) => r.id === selectedValue)?.url ?? null
                : null
            }
            owners={
              selectedValue
                ? rows.find((r) => r.id === selectedValue)?.usernames ?? null
                : null
            }
            onClose={() => setModalOpen(false)}
            onRemove={() => {
              // modal wipe-out finished -> trigger wheel pop animation
              setRemoveRequested(true);
            }}
          />
        </>
      )}
    </>
  );
}

export default App;
