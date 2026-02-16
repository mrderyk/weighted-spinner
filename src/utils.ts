export type EntryRow = {
  id: string;
  url: string;
  usernames: string;
  weight: string; // keep as string to match your inputs
};

const SHARE_PARAM = "s";

// --- base64url helpers ---
function base64UrlEncode(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function normalizeRow(x: unknown): EntryRow | null {
  if (!isObject(x)) return null;

  const id = typeof x.id === "string" ? x.id : "";
  const url = typeof x.url === "string" ? x.url : "";
  const usernames = typeof x.usernames === "string" ? x.usernames : "";

  // allow weight as string or number in stored payload, but normalize to string
  const weightIn =
    typeof x.weight === "string" || typeof x.weight === "number"
      ? String(x.weight)
      : "1";

  const w = Number(weightIn);
  const weight = Number.isFinite(w) && w >= 0 ? String(Math.floor(w)) : "0";

  return { id, url, usernames, weight };
}

export function encodeRows(rows: EntryRow[]) {
  // compact keys to keep URL shorter
  const payload = rows.map((r) => ({
    i: r.id ?? "",
    u: r.url ?? "",
    n: r.usernames ?? "",
    w: r.weight ?? "1",
  }));
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeRowsFromLocation(): EntryRow[] | null {
  if (typeof window === "undefined") return null;

  const sp = new URLSearchParams(window.location.search);
  const encoded = sp.get(SHARE_PARAM);
  if (!encoded) return null;

  try {
    if (encoded.length > 50_000) return null; // safety
    const json = base64UrlDecode(encoded);
    const data: unknown = JSON.parse(json);

    if (!Array.isArray(data) || data.length === 0) return null;

    const rows: EntryRow[] = [];
    for (const item of data) {
      // decode compact keys -> full row
      if (!isObject(item)) continue;

      const expanded: unknown = {
        id: item.i,
        url: item.u,
        usernames: item.n,
        weight: item.w,
      };

      const row = normalizeRow(expanded);
      if (row) rows.push(row);
    }

    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

export function writeRowsToUrl(rows: EntryRow[]) {
  if (typeof window === "undefined") return;

  const sp = new URLSearchParams(window.location.search);
  sp.set(SHARE_PARAM, encodeRows(rows));

  const newUrl = `${window.location.pathname}?${sp.toString()}${
    window.location.hash ?? ""
  }`;
  window.history.replaceState(null, "", newUrl);
}

export const handleSave = async (rowsToSave: EntryRow[]) => {
  // 1) Update URL with encoded rows
  writeRowsToUrl(rowsToSave);

  const url = window.location.href;

  // 2) Try modern clipboard API
  try {
    await navigator.clipboard.writeText(url);
    return;
  } catch {
    // fall through to legacy method
  }

  // 3) Fallback for older browsers / insecure contexts
  const textarea = document.createElement("textarea");
  textarea.value = url;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
};
