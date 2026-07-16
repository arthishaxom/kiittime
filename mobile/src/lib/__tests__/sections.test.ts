import { extractPrefixes, filterSections } from '@/lib/sections';
import type { Section } from '@/lib/api';

function section(overrides: Partial<Section>): Section {
  return {
    id: 1,
    section_name: 'CSE-1',
    year: 1,
    ...overrides,
  };
}

describe('extractPrefixes', () => {
  it('returns just "All" for an empty list', () => {
    expect(extractPrefixes([])).toEqual(['All']);
  });

  it('extracts unique, uppercased, sorted prefixes with "All" first', () => {
    const sections = [
      section({ section_name: 'cs1' }),
      section({ section_name: 'IT2' }),
      section({ section_name: 'CS3' }),
      section({ section_name: 'Mech1' }),
    ];

    expect(extractPrefixes(sections)).toEqual(['All', 'CS', 'IT', 'MECH']);
  });
});

describe('filterSections', () => {
  it('sorts alphanumerically when no filters are applied', () => {
    const sections = [
      section({ section_name: 'CS10' }),
      section({ section_name: 'CS2' }),
      section({ section_name: 'CS1' }),
    ];

    const result = filterSections(sections, { search: '', prefix: 'All' });

    expect(result.map((s) => s.section_name)).toEqual(['CS1', 'CS2', 'CS10']);
  });

  it('filters by case-insensitive search substring', () => {
    const sections = [
      section({ section_name: 'CS1' }),
      section({ section_name: 'IT1' }),
      section({ section_name: 'CS2' }),
    ];

    const result = filterSections(sections, { search: 'cs', prefix: 'All' });

    expect(result.map((s) => s.section_name)).toEqual(['CS1', 'CS2']);
  });

  it('filters by selected prefix', () => {
    const sections = [
      section({ section_name: 'CS1' }),
      section({ section_name: 'IT1' }),
      section({ section_name: 'CS2' }),
    ];

    const result = filterSections(sections, { search: '', prefix: 'IT' });

    expect(result.map((s) => s.section_name)).toEqual(['IT1']);
  });

  it('combines prefix and search filters', () => {
    const sections = [
      section({ section_name: 'CS10' }),
      section({ section_name: 'CS2' }),
      section({ section_name: 'IT1' }),
    ];

    const result = filterSections(sections, { search: '1', prefix: 'CS' });

    expect(result.map((s) => s.section_name)).toEqual(['CS10']);
  });
});
