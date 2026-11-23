// Pure helpers for matching scanned koli label codes to a Packing List (shared by UI, server and tests).
export type ParsedScan = { code: string; pl: string; n: number; total: number } | { code: string; error: string };

export function parseKoliCode(code: string): ParsedScan {
  const parts = code.trim().split("|");
  if (parts.length !== 4 || parts[0] !== "MRX") return { code, error: "Bukan label koli MR Express" };
  const n = Number(parts[2]), total = Number(parts[3]);
  if (!parts[1] || !Number.isInteger(n) || !Number.isInteger(total) || n < 1 || n > total) return { code, error: "Nomor koli tidak valid" };
  return { code, pl: parts[1], n, total };
}

/** Koli numbers 1..total that have a valid scan for this packing list. */
export function matchScans(plNumber: string, total: number, codes: string[]) {
  const verified = new Set<number>();
  const problems: { code: string; reason: string }[] = [];
  for (const c of codes) {
    const p = parseKoliCode(c);
    if ("error" in p) problems.push({ code: c, reason: p.error });
    else if (p.pl !== plNumber) problems.push({ code: c, reason: `Milik Packing List lain (${p.pl})` });
    else if (p.total !== total || p.n > total) problems.push({ code: c, reason: `Jumlah koli label (${p.total}) tidak sama dengan data (${total})` });
    else verified.add(p.n);
  }
  const unverified = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !verified.has(n));
  return { verified: [...verified].sort((a, b) => a - b), unverified, problems };
}
