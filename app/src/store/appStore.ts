import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getNotificationSettings } from "~/src/utils/notifications";
import type { AppState } from "./appState";

export const useAppStore = create<AppState>()(
	persist(
		(set) => ({
			rollNumber: null,
			notificationTime: 0,
			selectedSections: [],
			selectedYear: null,

			setRollNumber: async (rollNumber: string) => {
				set({ rollNumber });
			},

			setSelectedSections: (sections: string[]) => {
				set({ selectedSections: sections });
			},

			setSelectedYear: (year: string | null) => {
				set({ selectedYear: year });
			},
			setNotificationTime: async (minutes: number) => {
				set({ notificationTime: minutes });
				// Notifications will be updated by NotificationProvider
			},

			clearTimetable: async () => {
				set({
					rollNumber: null,
					notificationTime: 0,
					selectedSections: [],
					selectedYear: null,
				});
			},
		}),
		{
			name: "app-storage", // unique name for the storage key
			storage: createJSONStorage(() => AsyncStorage),
			// Only persist these fields
			partialize: (state) => ({
				rollNumber: state.rollNumber,
				selectedSections: state.selectedSections,
				selectedYear: state.selectedYear,
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
