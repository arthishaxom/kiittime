import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
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

// Storage keys
const STORAGE_KEYS = {
  TIMETABLE: "timetable",
  ROLL_NUMBER: "rollNumber",
  NOTIFICATION_TIME: "notificationTime",
} as const;

// Helper functions for manual storage
const storage = {
  async getTimetable(): Promise<GroupedSchedule> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TIMETABLE);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Error loading timetable from storage:", error);
      return {};
    }
  },

  async setTimetable(timetable: GroupedSchedule): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(timetable));
    } catch (error) {
      console.error("Error saving timetable to storage:", error);
    }
  },

  async getRollNumber(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ROLL_NUMBER);
    } catch (error) {
      console.error("Error loading roll number from storage:", error);
      return null;
    }
  },

  async setRollNumber(rollNumber: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ROLL_NUMBER, rollNumber);
    } catch (error) {
      console.error("Error saving roll number to storage:", error);
    }
  },

  async getNotificationTime(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_TIME);
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      console.error("Error loading notification time from storage:", error);
      return 0;
    }
  },

  async setNotificationTime(minutes: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_TIME, minutes.toString());
    } catch (error) {
      console.error("Error saving notification time to storage:", error);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TIMETABLE,
        STORAGE_KEYS.ROLL_NUMBER,
        STORAGE_KEYS.NOTIFICATION_TIME,
      ]);
    } catch (error) {
      console.error("Error clearing storage:", error);
    }
  },
};

export const useTimetableStore = create<TimetableState>((set, get) => ({
  timetable: {},
  isLoading: false,
  error: null,
  rollNumber: null,
  notificationTime: 0,

  setRollNumber: async (rollNumber: string) => {
    set({ rollNumber });
    await storage.setRollNumber(rollNumber);
  },

  setNotificationTime: async (minutes: number) => {
    const { timetable } = get();
    set({ notificationTime: minutes });
    await storage.setNotificationTime(minutes);

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
        timetable: groupedSchedule || [],
        rollNumber,
        isLoading: false,
      });

      // Save to storage
      await storage.setTimetable(groupedSchedule || {});
      await storage.setRollNumber(rollNumber);
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

    // Clear storage
    await storage.clearAll();
  },
}));

// Initialize store from storage on app start
export const initializeStore = async () => {
  try {
    const [timetable, rollNumber, notificationTime] = await Promise.all([
      storage.getTimetable(),
      storage.getRollNumber(),
      storage.getNotificationTime(),
    ]);

    useTimetableStore.setState({
      timetable,
      rollNumber,
      notificationTime,
    });

    // Rehydrate notification settings from storage
    try {
      const settings = await getNotificationSettings();
      if (settings.minutesBefore !== notificationTime) {
        useTimetableStore.setState({ notificationTime: settings.minutesBefore || 0 });
        await storage.setNotificationTime(settings.minutesBefore || 0);
      }
    } catch (error) {
      console.error("Error rehydrating notification settings:", error);
    }
  } catch (error) {
    console.error("Error initializing store from storage:", error);
  }
};
