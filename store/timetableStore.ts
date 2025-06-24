import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { supabase } from "~/services/supabase";
import { calculateAcademicYear } from "~/utils/helpers";
import { getNotificationSettings, updateNotificationSettings } from '~/utils/notifications';
import { GroupedSchedule, ScheduleSlot, TimetableState } from './timetableState';

export const useTimetableStore = create<TimetableState>((set, get) => ({
  timetable: {},
  isLoading: false,
  error: null,
  rollNumber: null,
  notificationTime: 15,
  setRollNumber: async (rollNumber: string) => {
    await AsyncStorage.setItem('rollNumber', rollNumber)
    set({ rollNumber })
  },
  setNotificationTime: async (minutes: number) => {
    const { timetable } = get();
    set({ notificationTime: minutes });
    // await AsyncStorage.setItem('notificationTime', minutes.toString());
    
    // Update notifications if timetable exists
    if (Object.keys(timetable).length > 0) {
      try {
        await updateNotificationSettings(minutes, timetable);
      } catch (error) {
        throw error
      }
    }
  },
  fetchTimetable: async (rollNumber: string) => {
    set({ isLoading: true, error: null });
    try {
      const localTimetable = await AsyncStorage.getItem('timetable')
      // const localNotificationTime = await AsyncStorage.getItem('notificationTime')
      const localNotificationTime = (await getNotificationSettings()).minutesBefore

      if (localTimetable !== null) {
        const timetable = JSON.parse(localTimetable);
        const notificationTime = localNotificationTime ? localNotificationTime : 0;
        set({ timetable, notificationTime, isLoading: false })
        return
      }

      const academicYear = calculateAcademicYear(rollNumber);

      const { data, error } = await supabase.rpc('get_complete_schedule', {
        student_roll: rollNumber,
        academic_year: academicYear
      })

      if (error) {
        throw new Error(error.message);
      }

      const groupedSchedule = data.reduce((acc: GroupedSchedule, slot: ScheduleSlot) => {
        const day = slot.Day; // Capitalized
        if (!acc[day]) acc[day] = [];
        acc[day].push(slot);
        return acc;
      }, {});

      await AsyncStorage.setItem('timetable', JSON.stringify(groupedSchedule))
      set({ timetable: groupedSchedule || [], isLoading: false });
    } catch (error) {
      set({ error, isLoading: false });
    }
  },
  clearTimetable: async () => {
    set({ isLoading: true })
    await AsyncStorage.clear()
    set({ timetable: {}, rollNumber: null, error: null, isLoading: false, notificationTime: 15 })
  },
})); 