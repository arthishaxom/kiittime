import type { Section } from '@/lib/api';

export function extractPrefixes(sections: Section[]): string[] {
  const unique = new Set<string>();
  for (const s of sections) {
    const match = /^[A-Z]+/i.exec(s.section_name);
    if (match) unique.add(match[0].toUpperCase());
  }
  return ['All', ...Array.from(unique).sort()];
}

export function filterSections(
  sections: Section[],
  { search, prefix }: { search: string; prefix: string },
): Section[] {
  const q = search.trim().toLowerCase();
  return sections
    .filter((s) => (q ? s.section_name.toLowerCase().includes(q) : true))
    .filter((s) => {
      if (prefix === 'All') return true;
      const match = /^[A-Z]+/i.exec(s.section_name);
      return match?.[0].toUpperCase() === prefix;
    })
    .sort((a, b) => a.section_name.localeCompare(b.section_name, undefined, { numeric: true }));
}
