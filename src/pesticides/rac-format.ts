/** Format CropLife RAC code with FRAC/IRAC/HRAC prefix when inferable. */
export function formatRacCode(code: string | null | undefined, useCategory: string | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  const raw = String(code).trim();
  if (!raw) return null;
  // Biological / blank markers
  if (raw === "-" || raw === "－" || raw.includes("生")) {
    return raw.replace(/[「」]/g, "");
  }
  const upper = raw.toUpperCase();
  if (upper.startsWith("FRAC-") || upper.startsWith("IRAC-") || upper.startsWith("HRAC-")) {
    return upper.includes("-") ? `${upper.slice(0, 4)}-${raw.slice(raw.indexOf("-") + 1)}` : raw;
  }
  if (upper.startsWith("FRAC") || upper.startsWith("IRAC") || upper.startsWith("HRAC")) {
    return raw;
  }

  const u = useCategory ?? "";
  if (u.includes("除草")) return `HRAC-${raw}`;
  if (u.includes("殺菌") && !u.includes("殺虫")) return `FRAC-${raw}`;
  if (u.includes("殺虫") && !u.includes("殺菌") && !u.includes("除草")) return `IRAC-${raw}`;
  return raw;
}

export function racSortKey(code: string): number {
  const c = code.toUpperCase();
  if (c.startsWith("FRAC")) return 1;
  if (c.startsWith("IRAC")) return 2;
  if (c.startsWith("HRAC")) return 3;
  return 9;
}

export function sortRacCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const oa = racSortKey(a);
    const ob = racSortKey(b);
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });
}
