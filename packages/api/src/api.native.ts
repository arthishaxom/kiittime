import * as shared from "./api-base";

const API_BASE_URL =
	(process as any).env?.EXPO_PUBLIC_API_BASE_URL ?? "https://kiittime-backend.onrender.com";

export * from "./api-base";

export const fetchSections = (year?: number) => shared.fetchSections(API_BASE_URL, year);
export const fetchTimetable = (sectionIds: number[]) => shared.fetchTimetable(API_BASE_URL, sectionIds);
export const fetchCurrentAnnouncement = () => shared.fetchCurrentAnnouncement(API_BASE_URL);
export const fetchRollNumberMapping = (rollNo: string) => shared.fetchRollNumberMapping(API_BASE_URL, rollNo);
export const sendOtp = (rollNo: string, sectionIds: number[]) => shared.sendOtp(API_BASE_URL, rollNo, sectionIds);
export const verifyOtp = (rollNo: string, otpCode: string) => shared.verifyOtp(API_BASE_URL, rollNo, otpCode);
