export interface TimetableState {
  timetable: GroupedSchedule;
  isLoading: boolean;
  error: any;
  rollNumber: string | null;
  notificationTime: number;
  setRollNumber: (rollNumber: string) => Promise<void>;
  fetchTimetable: (rollNumber: string) => Promise<void>;
  clearTimetable: () => Promise<void>;
  setNotificationTime: (minutes: number) => Promise<void>;
}

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