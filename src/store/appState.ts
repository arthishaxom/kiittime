/**
 * AppState: Client-side application state
 *
 * This store holds user preferences and app configuration.
 * Server data (timetables, exams) is managed by React Query.
 */
export interface AppState {
	// User Selection
	rollNumber: string | null;
	selectedSections: string[];
	selectedYear: string | null;

	// App Settings
	notificationTime: number; // Minutes before class to notify

	// Actions
	setRollNumber: (rollNumber: string) => Promise<void>;
	setSelectedSections: (sections: string[]) => void;
	setSelectedYear: (year: string | null) => void;
	setNotificationTime: (minutes: number) => Promise<void>;
	clearTimetable: () => Promise<void>;
}

// Kept for backward compatibility with existing code
export type TimetableState = AppState;

export type ScheduleSlot = {
	Day: string;
	Room: string;
	Section: string;
	Subject: string;
	Time: string;
	Time_Sort: number;
};

export type GroupedSchedule = {
	[day: string]: ScheduleSlot[];
};
