import { useQuery } from "@tanstack/react-query";
import { fetchTimetable } from "@kiittime/api/api";

export function useTimetable(sectionIds: number[]) {
	return useQuery({
		queryKey: ["timetable", sectionIds] as const,
		queryFn: () => fetchTimetable(sectionIds),
		enabled: sectionIds.length > 0,
	});
}
