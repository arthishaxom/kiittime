// Deep link shape for the timetable screen: kiittime://timetable?section_id=1 (repeat the
// param for multiple ids, e.g. ?section_id=1&section_id=2). Resolved by expo-router's default
// file-based linking from the `kiittime` scheme declared in app.config.js — no custom linking
// config needed. Future producers (QR codes, notifications) should target this shape.
export function parseSectionIds(param: string | string[] | undefined): number[] {
  if (param === undefined) return [];
  try {
    const values = Array.isArray(param) ? param : [param];
    return values.map((v) => {
      if (v.trim() === '') throw new Error('empty');
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error('not a number');
      return n;
    });
  } catch {
    return [];
  }
}
