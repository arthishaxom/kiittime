// Deep link shape for the timetable screen: kiittime://timetable?section_id=1 (repeat the
// param for multiple ids, e.g. ?section_id=1&section_id=2). Resolved by expo-router's default
// file-based linking from the `kiittime` scheme declared in app.config.js — no custom linking
// config needed. Future producers (QR codes, notifications) should target this shape.
//
// Build hrefs with `timetableHref` below rather than `router.push({ params: { section_id: [...] } })`:
// expo-router's object-params serializer joins array values with `.toString()` (a comma), not
// repeated keys, so multi-section navigation silently breaks. Passing a pre-built string href
// routes through the same URL parser used for deep links, which does handle repeated keys.
export function timetableHref(sectionIds: number[]): `/timetable?${string}` {
  const qs = sectionIds.map((id) => `section_id=${encodeURIComponent(id)}`).join('&');
  return `/timetable?${qs}`;
}

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
