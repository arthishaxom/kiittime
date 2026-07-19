export type ScopeMode = "year" | "sections";

export function buildScopeBody(
	mode: ScopeMode,
	year: number | null,
	sectionIdsInput: string,
): { section_ids: number[] | null; year: number | null } {
	switch (mode) {
		case "year":
			return { section_ids: null, year };
		case "sections": {
			const ids = sectionIdsInput
				.split(",")
				.map((s) => Number.parseInt(s.trim(), 10))
				.filter((n) => !Number.isNaN(n));
			return { section_ids: ids.length > 0 ? ids : null, year: null };
		}
	}
}
