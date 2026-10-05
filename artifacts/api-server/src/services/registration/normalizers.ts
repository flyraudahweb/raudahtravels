/**
 * Normalizers for duplicate detection and field comparison.
 * Pure functions — no DB access, no side effects.
 */

/** Normalize passport number: uppercase, strip non-alphanumerics */
export function normalizePassport(value: string | null | undefined): string {
  if (!value) return "";
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Normalize phone: digits only, strip leading zeros, keep last 10 digits */
export function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  // Handle Nigerian numbers: +2348031234567 → 8031234567
  if (digits.length > 10 && digits.startsWith("234")) {
    return digits.slice(-10);
  }
  return digits.slice(-10);
}

/** Normalize email: lowercase, trim */
export function normalizeEmail(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().trim();
}

/** Normalize name: lowercase, collapse whitespace, strip punctuation */
export function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein distance — used for fuzzy name matching.
 * O(n*m) but names are short so this is fine.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[n];
}

/** Similarity ratio 0–1 (1 = identical) */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

/** Normalize date to YYYY-MM-DD for comparison */
export function normalizeDate(value: string | null | undefined): string {
  if (!value) return "";
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Try parsing
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Mask passport number for logging: A12345678 → A1234**** */
export function maskPassport(value: string | null | undefined): string {
  if (!value) return "";
  const n = normalizePassport(value);
  if (n.length <= 4) return "****";
  return n.slice(0, 4) + "****";
}

/** Mask phone for logging: 8031234567 → 803****567 */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return "";
  const n = normalizePhone(value);
  if (n.length <= 4) return "****";
  return n.slice(0, 3) + "****" + n.slice(-2);
}
