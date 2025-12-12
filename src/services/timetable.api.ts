import type { GroupedSchedule, ScheduleSlot } from "@/src/store/appState";
import { calculateAcademicYear } from "~/src/utils/helpers";
import { supabase } from "./supabase";

export async function fetchTimetableByRoll(
	rollNumber: string,
): Promise<GroupedSchedule> {
	const academicYear = calculateAcademicYear(rollNumber);
	const { data, error } = await supabase.rpc("get_complete_schedule", {
		student_roll: rollNumber,
		academic_year: academicYear,
	});
	if (error) throw new Error(error.message);
	if (!data || data.length === 0)
		throw new Error("No timetable found for this roll number");
	return groupByDay(data as ScheduleSlot[]);
}

export async function fetchTimetableBySections(
	sections: string[],
	academicYear: string,
): Promise<GroupedSchedule> {
	const tableName = `year${academicYear}_tt`;
	const { data, error } = await supabase
		.from(tableName)
		.select("Day,Room,Subject,Time,Time_Sort,Section")
		.in("Section", sections);
	if (error) throw new Error(error.message);
	if (!data || data.length === 0)
		throw new Error("No timetable found for these sections");
	return groupByDay(data as ScheduleSlot[]);
}

function groupByDay(slots: ScheduleSlot[]): GroupedSchedule {
	return slots.reduce((acc, slot) => {
		if (!acc[slot.Day]) acc[slot.Day] = [];
		acc[slot.Day].push(slot);
		return acc;
	}, {} as GroupedSchedule);
}
