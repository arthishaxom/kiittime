import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "~/services/supabase";
import { calculateAcademicYear } from "~/utils/helpers";
import {
	getNotificationSettings,
	updateNotificationSettings,
} from "~/utils/notifications";
import type {
	GroupedSchedule,
	ScheduleSlot,
	TimetableState,
} from "./timetableState";

export const useTimetableStore = create<TimetableState>()(
	persist(
		(set, get) => ({
			timetable: {},
			isLoading: false,
			error: null,
			rollNumber: null,
			notificationTime: 0,

			setRollNumber: async (rollNumber: string) => {
				set({ rollNumber });
			},

			setNotificationTime: async (minutes: number) => {
				const { timetable } = get();
				set({ notificationTime: minutes });

				// Update notifications if timetable exists
				if (Object.keys(timetable).length > 0) {
					await updateNotificationSettings(minutes, timetable);
				}
			},

			fetchTimetable: async (rollNumber: string) => {
				set({ isLoading: true, error: null });
				try {
					const academicYear = calculateAcademicYear(rollNumber);

					const { data, error } = await supabase.rpc("get_complete_schedule", {
						student_roll: rollNumber,
						academic_year: academicYear,
					});

					if (error) {
						throw new Error(error.message);
					}

					if (!data || data.length === 0) {
						throw new Error("No timetable found for this roll number");
					}

					const groupedSchedule = data.reduce(
						(acc: GroupedSchedule, slot: ScheduleSlot) => {
							const day = slot.Day; // Capitalized
							if (!acc[day]) acc[day] = [];
							acc[day].push(slot);
							return acc;
						},
						{},
					);

					set({
						timetable: groupedSchedule || {},
						rollNumber,
						isLoading: false,
					});
				} catch (error) {
					const errorMessage =
						error instanceof Error
							? error.message
							: "An unknown error occurred";
					set({ error: errorMessage, isLoading: false });
				}
			},

			clearTimetable: async () => {
				set({ isLoading: true });
				// Clear notifications
				try {
					await updateNotificationSettings(0, {});
				} catch (error) {
					console.error("Failed to clear notifications:", error);
				}
				set({
					timetable: {},
					rollNumber: null,
					error: null,
					isLoading: false,
					notificationTime: 0,
				});
			},
		}),
		{
			name: "timetable-storage", // unique name for the storage key
			storage: createJSONStorage(() => AsyncStorage),
			// Only persist these fields
			partialize: (state) => ({
				timetable: state.timetable,
				rollNumber: state.rollNumber,
				notificationTime: state.notificationTime,
			}),
			// Skip hydration on web to avoid Vercel issues
			skipHydration: Platform.OS === "web",
			// Optional: migrate old storage format if needed
			onRehydrateStorage: () => (state) => {
				if (state) {
					// Rehydrate notification settings from storage
					getNotificationSettings()
						.then((settings) => {
							if (settings.minutesBefore !== state.notificationTime) {
								state.notificationTime = settings.minutesBefore || 0;
							}
						})
						.catch(console.error);
				}
			},
		},
	),
);
