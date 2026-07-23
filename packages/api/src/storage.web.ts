export const STORAGE_KEY = "kiit-time:selected-sections";
export const LAST_SEEN_ANNOUNCEMENT_KEY = "kiit-time:last-seen-announcement";
export const ACTIVE_ROLL_NO_KEY = "kiit-time:active-roll-no";
export const ACTIVE_ACADEMIC_YEAR_KEY = "kiit-time:active-academic-year";
export const TEMP_LINKING_ROLL_NO_KEY = "kiit-time:temp-linking-roll-no";
export const LAST_SHOWN_UPDATE_ID_KEY = "kiit-time:last-shown-update-id";

export function getSavedSectionIds(): number[] | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === "number"))
			return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveSectionIds(ids: number[]): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function getLastSeenAnnouncementId(): number | null {
	try {
		const raw = localStorage.getItem(LAST_SEEN_ANNOUNCEMENT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (typeof parsed !== "number") return null;
		return parsed;
	} catch {
		return null;
	}
}

export function setLastSeenAnnouncementId(id: number): void {
	localStorage.setItem(LAST_SEEN_ANNOUNCEMENT_KEY, JSON.stringify(id));
}

export function getTempLinkingRollNo(): string | null {
	return localStorage.getItem(TEMP_LINKING_ROLL_NO_KEY);
}

export function saveTempLinkingRollNo(rollNo: string): void {
	localStorage.setItem(TEMP_LINKING_ROLL_NO_KEY, rollNo);
}

export function clearTempLinkingRollNo(): void {
	localStorage.removeItem(TEMP_LINKING_ROLL_NO_KEY);
}

export function getActiveRollNo(): string | null {
	return localStorage.getItem(ACTIVE_ROLL_NO_KEY);
}

export function setActiveRollNo(rollNo: string): void {
	localStorage.setItem(ACTIVE_ROLL_NO_KEY, rollNo);
}

export function clearActiveRollNo(): void {
	localStorage.removeItem(ACTIVE_ROLL_NO_KEY);
}

export function getActiveAcademicYear(): number | null {
	try {
		const raw = localStorage.getItem(ACTIVE_ACADEMIC_YEAR_KEY);
		if (!raw) return null;
		const parsed = parseInt(raw, 10);
		if (isNaN(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function setActiveAcademicYear(year: number): void {
	localStorage.setItem(ACTIVE_ACADEMIC_YEAR_KEY, String(year));
}

export function clearActiveAcademicYear(): void {
	localStorage.removeItem(ACTIVE_ACADEMIC_YEAR_KEY);
}

export function getLastShownUpdateId(): string | null {
	try {
		return localStorage.getItem(LAST_SHOWN_UPDATE_ID_KEY);
	} catch {
		return null;
	}
}

export function setLastShownUpdateId(id: string): void {
	localStorage.setItem(LAST_SHOWN_UPDATE_ID_KEY, id);
}

