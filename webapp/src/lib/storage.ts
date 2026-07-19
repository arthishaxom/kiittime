const STORAGE_KEY = "kiit-time:selected-sections";
const LAST_SEEN_ANNOUNCEMENT_KEY = "kiit-time:last-seen-announcement";

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
