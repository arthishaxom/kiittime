import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { useSections } from "#/hooks/useSections";
import { buildMailto } from "#/lib/mailto";
import { saveSectionIds } from "#/lib/storage";

export function SectionSearch({ year }: { year: number }) {
	const navigate = useNavigate();

	const [search, setSearch] = useState("");
	const [selectedIds, setSelectedIds] = useState<number[]>([]);
	const [selectedPrefix, setSelectedPrefix] = useState("All");

	const { data: sections, isLoading, isError } = useSections(year);

	const prefixes = useMemo(() => {
		if (!sections) return [];
		const unique = new Set<string>();
		for (const s of sections) {
			const match = /^[A-Z]+/i.exec(s.section_name);
			if (match) unique.add(match[0].toUpperCase());
		}
		return ["All", ...Array.from(unique).sort()];
	}, [sections]);

	const filtered = useMemo(() => {
		if (!sections) return [];
		const q = search.trim().toLowerCase();
		return sections
			.filter((s) => (q ? s.section_name.toLowerCase().includes(q) : true))
			.filter((s) => {
				if (selectedPrefix === "All") return true;
				const match = /^[A-Z]+/i.exec(s.section_name);
				return match?.[0].toUpperCase() === selectedPrefix;
			})
			.sort((a, b) =>
				a.section_name.localeCompare(b.section_name, undefined, {
					numeric: true,
				}),
			);
	}, [sections, search, selectedPrefix]);

	const selectedSections = useMemo(
		() => sections?.filter((s) => selectedIds.includes(s.id)) ?? [],
		[sections, selectedIds],
	);

	const MAX_SECTIONS = 5;
	const atCap = selectedIds.length >= MAX_SECTIONS;

	function toggleSection(id: number) {
		setSelectedIds((prev) => {
			if (prev.includes(id)) return prev.filter((x) => x !== id);
			if (prev.length >= MAX_SECTIONS) return prev;
			return [...prev, id];
		});
	}

	return (
		<div className="min-h-screen bg-bg text-text flex flex-col p-4">
			<div className="flex items-center gap-3 mb-4">
				<button
					type="button"
					onClick={() => navigate({ to: "/" })}
					className="text-2xl"
				>
					←
				</button>
				<h1 className="text-xl font-bold flex-1 text-center">
					Select Sections
				</h1>
				<button
					type="button"
					disabled={selectedIds.length === 0}
					onClick={() => {
						saveSectionIds(selectedIds);
						navigate({
							to: "/timetable",
							search: { section_id: selectedIds },
						});
					}}
					className="text-brand font-semibold disabled:opacity-40 disabled:pointer-events-none"
				>
					Done
				</button>
			</div>

			<Input
				placeholder="Search sections…"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				className="mb-4"
			/>

			{prefixes.length > 1 && (
				<Select value={selectedPrefix} onValueChange={setSelectedPrefix}>
					<SelectTrigger className="mb-4 w-full bg-surface border-border text-text">
						<SelectValue placeholder="All" />
					</SelectTrigger>
					<SelectContent className="bg-sheet border-border text-text">
						{prefixes.map((prefix) => (
							<SelectItem
								key={prefix}
								value={prefix}
								className="text-text cursor-pointer hover:bg-surface focus:bg-surface"
							>
								{prefix}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}

			{selectedSections.length > 0 && (
				<div className="mb-4">
					<p className="text-sm text-text-muted mb-2">
						Selected Sections ({selectedSections.length})
					</p>
					<div className="flex flex-wrap gap-2">
						{selectedSections.map((s) => (
							<Badge
								key={s.id}
								className="cursor-pointer"
								onClick={() => toggleSection(s.id)}
							>
								{s.section_name} ×
							</Badge>
						))}
					</div>
					{atCap && <p className="text-danger text-xs mt-2">Max 5 sections</p>}
				</div>
			)}

			<p className="text-sm text-text-muted mb-2">
				Available Sections (Year {year})
			</p>

			<div className="flex-1 overflow-y-auto flex flex-col gap-2">
				{isLoading && (
					<p className="text-text-muted text-sm">Loading sections…</p>
				)}
				{isError && (
					<p className="text-danger text-sm">Failed to load sections.</p>
				)}
				{!isLoading && !isError && (!sections || sections.length === 0) && (
					<div className="text-center text-text-muted py-8">
						<p>No sections available for Year {year} yet.</p>
						<a
							href={buildMailto({
								subject: `KIIT Time - No sections for Year ${year}`,
								body: `Hi, I noticed there are no sections listed yet for Year ${year}. Could you add them?`,
							})}
							className="text-brand underline"
						>
							Email me to request it
						</a>
					</div>
				)}
				{!isLoading &&
					!isError &&
					sections &&
					sections.length > 0 &&
					filtered.length === 0 && (
						<div className="text-center text-text-muted py-8">
							<p>No sections match "{search}".</p>
							<p className="text-sm">Try a different search term.</p>
						</div>
					)}
				{filtered.map((s) => {
					const isSelected = selectedIds.includes(s.id);
					return (
						<button
							key={s.id}
							type="button"
							onClick={() => toggleSection(s.id)}
							className={`h-14 rounded-lg px-4 text-left font-medium transition-colors ${
								isSelected
									? "bg-brand text-white"
									: "bg-surface text-text border border-border"
							}`}
						>
							{s.section_name}
						</button>
					);
				})}
			</div>
		</div>
	);
}
