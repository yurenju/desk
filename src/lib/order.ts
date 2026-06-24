// Fractional lexicographic key generator for manual ordering (`position` field).
// Keys are compared with plain string `<`. midpoint(a, b) returns a key strictly
// between a and b; null bounds mean "before everything" / "after everything".
//
// ponytail: midpoint can grow the string without bound under pathological
// repeated insertion at the same spot. Upgrade path when keys get long: rebalance
// the whole bucket (reassign evenly spaced keys in one pass). Buckets here are
// small (handful to dozens), so this is not a near-term concern.

const FIRST = "a";
const LAST = "z";

// Average of two single chars within [MIN..MAX]; returns -1 if they are adjacent.
function midChar(loCode: number, hiCode: number): number {
  if (hiCode - loCode <= 1) return -1;
  return Math.floor((loCode + hiCode) / 2);
}

const MIN = "a".charCodeAt(0); // exclusive lower sentinel
const MAX = "z".charCodeAt(0) + 1; // exclusive upper sentinel

export function midpoint(a: string | null, b: string | null): string {
  const lo = a ?? "";
  const hi = b ?? "";
  let i = 0;
  let prefix = "";
  // Walk shared prefix; at the first differing position try to fit a char between.
  for (;;) {
    const loCode = i < lo.length ? lo.charCodeAt(i) : MIN;
    const hiCode = i < hi.length ? hi.charCodeAt(i) : MAX;
    if (loCode === hiCode) {
      prefix += String.fromCharCode(loCode);
      i++;
      continue;
    }
    const mid = midChar(loCode, hiCode);
    if (mid !== -1) return prefix + String.fromCharCode(mid);
    // Adjacent here (e.g. "ab" vs "ac"): keep lo's char and recurse into the
    // next position with an open upper bound until a gap appears.
    prefix += String.fromCharCode(loCode);
    i++;
    // hi is now effectively MAX from here on (we passed its differing char).
    // Continue scanning lo against MAX.
    for (;;) {
      const lc = i < lo.length ? lo.charCodeAt(i) : MIN;
      const m2 = midChar(lc, MAX);
      if (m2 !== -1) return prefix + String.fromCharCode(m2);
      prefix += String.fromCharCode(lc);
      i++;
    }
  }
}

export { FIRST, LAST };
