import { useIsRestoring, useQueryClient } from "@tanstack/react-query";
import { Redirect, SplashScreen } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useAppStore } from "~/src/store/appStore";

// Only allow the two possible redirect destinations
const TIMETABLE = "/timetable" as const;
const ROLL_INPUT = "/roll-input" as const;
type RedirectPath = typeof TIMETABLE | typeof ROLL_INPUT;

export default function IndexRedirect() {
	const [redirect, setRedirect] = useState<RedirectPath | null>(null);
	const [isReady, setIsReady] = useState(false);

	// Zustand hydration (mobile)
	const hasHydrated =
		Platform.OS !== "web" ? useAppStore.persist.hasHydrated() : true;

	// Read client state from Zustand (React Query is source of truth for timetable data)
	const rollNumber = useAppStore((s) => s.rollNumber);
	const selectedYear = useAppStore((s) => s.selectedYear);
	const selectedSections = useAppStore((s) => s.selectedSections);

	// React Query cache + restore state (if you use PersistQueryClientProvider)
	const qc = useQueryClient();
	const isRestoring = useIsRestoring();

	useEffect(() => {
		// Wait for Zustand hydration and (if used) React Query cache restore
		if (!(Platform.OS === "web" || hasHydrated)) return;
		if (isRestoring) return;

		const hasConfig =
			!!rollNumber || (!!selectedYear && selectedSections.length > 0);

		// Try to find a cached timetable in React Query (both roll-based and sections-based keys)
		const keyByRoll = rollNumber ? ["timetable", "roll", rollNumber] : null;

		// Sort sections to ensure consistent cache key matching
		const sortedSections =
			selectedSections.length > 0
				? [...selectedSections].sort()
				: selectedSections;

		const keyBySections =
			selectedYear && selectedSections.length > 0
				? [
						"timetable",
						"sections",
						{ sections: sortedSections, year: selectedYear },
					]
				: null;

		const cachedByRoll = keyByRoll
			? qc.getQueryData<object>(keyByRoll)
			: undefined;
		const cachedBySections = keyBySections
			? qc.getQueryData<object>(keyBySections)
			: undefined;
		const hasNonEmptyTimetable = (data: unknown) =>
			!!data && typeof data === "object" && Object.keys(data).length > 0;

		const hasCached =
			hasNonEmptyTimetable(cachedByRoll) ||
			hasNonEmptyTimetable(cachedBySections);

		// Redirect:
		// - If we have cached timetable → /timetable
		// - Else if we at least have config (rollNumber or sections/year) → /timetable (it will fetch)
		// - Else → /roll-input
		if (hasCached || hasConfig) {
			setRedirect(TIMETABLE);
		} else {
			setRedirect(ROLL_INPUT);
		}

		setIsReady(true);
		SplashScreen.hideAsync();
	}, [
		hasHydrated,
		isRestoring,
		qc,
		rollNumber,
		selectedYear,
		selectedSections,
	]);

	if (!redirect || !isReady) return null;
	return <Redirect href={redirect} />;
}
