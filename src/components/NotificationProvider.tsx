import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useRef } from "react";
import type { GroupedSchedule } from "~/src/store/appState";
import { useAppStore } from "~/src/store/appStore";
import {
	initializeNotificationService,
	setupNotificationListeners,
	updateNotificationSettings,
} from "~/src/utils/notifications";

interface NotificationProviderProps {
	children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
	children,
}) => {
	const qc = useQueryClient();
	const rollNumber = useAppStore((s) => s.rollNumber);
	const selectedSections = useAppStore((s) => s.selectedSections);
	const selectedYear = useAppStore((s) => s.selectedYear);
	const notificationTime = useAppStore((s) => s.notificationTime);

	const prevRef = useRef<{
		notificationTime: number;
		timetable: unknown;
	} | null>(null);

	useEffect(() => {
		const initializeNotifications = async () => {
			try {
				await initializeNotificationService();
				setupNotificationListeners();
			} catch (error) {
				console.error("Failed to initialize notification service:", error);
			}
		};

		initializeNotifications();
	}, []);

	// React to timetable or notificationTime changes
	useEffect(() => {
		const keyByRoll = rollNumber ? ["timetable", "roll", rollNumber] : null;
		const keyBySections =
			selectedYear && selectedSections.length > 0
				? [
						"timetable",
						"sections",
						{ sections: selectedSections, year: selectedYear },
					]
				: null;

		const cachedByRoll = keyByRoll
			? qc.getQueryData<GroupedSchedule>(keyByRoll)
			: undefined;
		const cachedBySections = keyBySections
			? qc.getQueryData<GroupedSchedule>(keyBySections)
			: undefined;

		const timetable = cachedByRoll || cachedBySections || {};

		const changed =
			!prevRef.current ||
			prevRef.current.notificationTime !== notificationTime ||
			prevRef.current.timetable !== timetable;

		if (changed && Object.keys(timetable).length > 0) {
			updateNotificationSettings(notificationTime, timetable).catch(
				console.error,
			);
			prevRef.current = { notificationTime, timetable };
		} else if (
			changed &&
			Object.keys(timetable).length === 0 &&
			notificationTime === 0
		) {
			// Clear notifications when timetable empty
			updateNotificationSettings(0, {}).catch(console.error);
			prevRef.current = { notificationTime, timetable };
		}
	}, [qc, rollNumber, selectedSections, selectedYear, notificationTime]);

	return <>{children}</>;
};
