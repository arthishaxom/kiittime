import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	fetchTimetableByRoll,
	fetchTimetableBySections,
} from "~/src/services/timetable.api";
import type { GroupedSchedule } from "~/src/store/appState";
import { useAppStore } from "~/src/store/appStore";
import {
	cancelAllNotifications,
	updateNotificationSettings,
} from "~/src/utils/notifications";

/**
 * Fetch timetable by roll number
 * Uses offline-first mode - shows cached data even when offline
 */
export function useTimetableByRoll(rollNumber?: string | null) {
	return useQuery({
		queryKey: ["timetable", "roll", rollNumber],
		queryFn: () => fetchTimetableByRoll(rollNumber || ""),
		enabled: !!rollNumber,
		networkMode: "offlineFirst",
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
	});
}

/**
 * Fetch timetable by sections
 * Uses offline-first mode - shows cached data even when offline
 */
export function useTimetableBySections(
	sections: string[],
	year?: string | null,
) {
	// Sort sections to ensure consistent cache key
	const sortedSections = sections.length > 0 ? [...sections].sort() : sections;

	return useQuery({
		queryKey: ["timetable", "sections", { sections: sortedSections, year }],
		queryFn: () => fetchTimetableBySections(sections, year || ""),
		enabled: !!year && sections.length > 0,
		networkMode: "offlineFirst",
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 7 * 24 * 60 * 60 * 1000,
	});
}

/**
 * Prefetch timetable by roll number
 * Used during roll input to load data before navigation
 */
export function usePrefetchTimetableByRoll() {
	const qc = useQueryClient();
	const notificationTime = useAppStore((state) => state.notificationTime);
	return useMutation({
		mutationFn: (roll: string) => fetchTimetableByRoll(roll),
		onSuccess: async (data, roll) => {
			qc.setQueryData<GroupedSchedule>(["timetable", "roll", roll], data);
			if (notificationTime > 0) {
				await updateNotificationSettings(notificationTime, data);
			}
		},
	});
}

/**
 * Prefetch timetable by sections
 * Used during section selection to load data before navigation
 */
export function usePrefetchTimetableBySections() {
	const qc = useQueryClient();
	const notificationTime = useAppStore((state) => state.notificationTime);
	return useMutation({
		mutationFn: (vars: { sections: string[]; year: string }) =>
			fetchTimetableBySections(vars.sections, vars.year),
		onSuccess: async (data, { sections, year }) => {
			// Sort sections to ensure consistent cache key
			const sortedSections = [...sections].sort();

			qc.setQueryData<GroupedSchedule>(
				["timetable", "sections", { sections: sortedSections, year }],
				data,
			);
			if (notificationTime > 0) {
				await updateNotificationSettings(notificationTime, data);
			}
		},
	});
}

/**
 * Clear timetable mutation
 * Cancels notifications, clears app store, and removes query cache
 */
export function useClearTimetable() {
	const qc = useQueryClient();
	const clearStore = useAppStore((s) => s.clearTimetable);

	return useMutation({
		mutationFn: async () => {
			await cancelAllNotifications();
			return true;
		},
		onSuccess: async () => {
			clearStore();
			await qc.invalidateQueries({ queryKey: ["timetable"] });
			qc.removeQueries({ queryKey: ["timetable"] });
		},
	});
}

/**
 * Fetch available sections for a given year
 */
export function useSections(year: string | null, search: string = "") {
	return useQuery({
		queryKey: ["sections", year, search],
		queryFn: async () => {
			const { supabase } = await import("~/src/services/supabase");
			const { data } = await supabase.rpc("get_distinct_sections", {
				academic_year: year,
			});
			const sections = (data || []) as string[];
			if (!search) return sections;
			return sections.filter((s: string) =>
				s.toLowerCase().includes(search.toLowerCase()),
			);
		},
		enabled: !!year,
		networkMode: "offlineFirst",
		staleTime: 10 * 60 * 1000, // 10 minutes
		gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
	});
}
