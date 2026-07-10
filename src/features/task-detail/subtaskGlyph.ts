// Pie glyph filled by completion ratio. 0 → empty, complete → full; any partial
// progress clamps to ◔/◑/◕ so "some done" never reads as empty and "not all
// done" never reads as full.
export function subtaskGlyph(done: number, total: number): string {
  if (total <= 0 || done <= 0) return "○";
  if (done >= total) return "●";
  const q = Math.min(3, Math.max(1, Math.round((done / total) * 4)));
  return ["◔", "◑", "◕"][q - 1];
}
