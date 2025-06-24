import Toast from "react-native-toast-message";
import { DAYS, TIME_SLOTS } from "./constants";

export const getCurrentDay = () => {
  const today = new Date();
  const dayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const day = DAYS[dayIndex === 0 ? 6 : dayIndex - 1]; // Adjust for our array
  return { day, dayIndex: dayIndex === 0 ? 6 : dayIndex - 1 };
};

export const getCurrentTimeSlot = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  for (let i = 0; i < TIME_SLOTS.length; i++) {
    const [startTime] = TIME_SLOTS[i].split("-");
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const slotStartTime = startHour * 60 + startMinute;

    if (currentTime >= slotStartTime && currentTime < slotStartTime + 60) {
      return TIME_SLOTS[i];
    }
  }

  return null;
}; 

export const calculateAcademicYear = (rollNumber: string) => {
  // Extract the first two digits from roll number (admission year)
  const admissionYear = parseInt('20' + rollNumber.substring(0, 2));
  
  // Get current date
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11
  
  // Calculate base academic year (difference between current year and admission year)
  let academicYear = currentYear - admissionYear;
  
  // If current month is July (7) or later, increment academic year by 1
  // This accounts for the new semester starting
  if (currentMonth >= 7) {
    academicYear += 1;
  }
  
  return academicYear;
}

export const showToast = (type: string, text1: string, text2: string) => {
  Toast.show({
    type,
    text1,
    text2,
    visibilityTime: 3000,
  });
};