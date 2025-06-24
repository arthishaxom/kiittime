// Mock data for demonstration - replace with actual Supabase implementation
// const mockTimetableData = [
//   {
//     id: "1",
//     Day: "Monday",
//     Room: "A101",
//     Section: "A",
//     Subject: "Mathematics",
//     Time: "08:00-09:00",
//     Time_Sort: 1,
//   },
//   {
//     id: "2", 
//     Day: "Monday",
//     Room: "B202",
//     Section: "A",
//     Subject: "Physics",
//     Time: "09:00-10:00",
//     Time_Sort: 2,
//   },
//   {
//     id: "3",
//     Day: "Tuesday",
//     Room: "C303",
//     Section: "A", 
//     Subject: "Chemistry",
//     Time: "10:00-11:00",
//     Time_Sort: 3,
//   },
//   {
//     id: "4",
//     Day: "Wednesday",
//     Room: "D404",
//     Section: "A",
//     Subject: "Computer Science",
//     Time: "11:00-12:00", 
//     Time_Sort: 4,
//   },
//   {
//     id: "5",
//     Day: "Thursday",
//     Room: "E505",
//     Section: "A",
//     Subject: "English",
//     Time: "12:00-13:00",
//     Time_Sort: 5,
//   },
//   {
//     id: "6",
//     Day: "Friday",
//     Room: "F606",
//     Section: "A",
//     Subject: "History",
//     Time: "13:00-14:00",
//     Time_Sort: 6,
//   },
// ];

// export const fetchTimetableByRollNumber = async (rollNumber: string) => {
//   // Simulate API delay
//   await new Promise(resolve => setTimeout(resolve, 1000));
  
//   // Validate roll number format (XX-XXXXX)
//   // const rollNumberRegex = /^\d{2}-\d{5}$/;
//   // if (!rollNumberRegex.test(rollNumber)) {
//   //   throw new Error("Invalid roll number format. Expected format: XX-XXXXX");
//   // }

//   // For demo purposes, return mock data for any valid roll number
//   // In production, this would query Supabase with the actual roll number
//   return mockTimetableData;
// };

// Example Supabase implementation (uncomment and configure for production use)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SB_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SB_ANON!;

export const supabase = createClient(supabaseUrl, supabaseKey);


