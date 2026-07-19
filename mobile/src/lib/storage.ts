import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'kiit-time:selected-sections';
const LAST_SEEN_ANNOUNCEMENT_KEY = 'kiit-time:last-seen-announcement';

export async function getSavedSectionIds(): Promise<number[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === 'number')) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSectionIds(ids: number[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export async function clearSavedSectionIds(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function getLastSeenAnnouncementId(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SEEN_ANNOUNCEMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setLastSeenAnnouncementId(id: number): Promise<void> {
  await AsyncStorage.setItem(LAST_SEEN_ANNOUNCEMENT_KEY, JSON.stringify(id));
}

const TEMP_LINKING_ROLL_NO_KEY = 'kiit-time:temp-linking-roll-no';

export async function getTempLinkingRollNo(): Promise<string | null> {
  return AsyncStorage.getItem(TEMP_LINKING_ROLL_NO_KEY);
}

export async function saveTempLinkingRollNo(rollNo: string): Promise<void> {
  await AsyncStorage.setItem(TEMP_LINKING_ROLL_NO_KEY, rollNo);
}

export async function clearTempLinkingRollNo(): Promise<void> {
  await AsyncStorage.removeItem(TEMP_LINKING_ROLL_NO_KEY);
}

const ACTIVE_ROLL_NO_KEY = 'kiit-time:active-roll-no';
const ACTIVE_ACADEMIC_YEAR_KEY = 'kiit-time:active-academic-year';

export async function getActiveRollNo(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_ROLL_NO_KEY);
}

export async function saveActiveRollNo(rollNo: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_ROLL_NO_KEY, rollNo);
}

export async function clearActiveRollNo(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_ROLL_NO_KEY);
}

export async function getActiveAcademicYear(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_ACADEMIC_YEAR_KEY);
    if (!raw) return null;
    return Number(raw);
  } catch {
    return null;
  }
}

export async function saveActiveAcademicYear(year: number): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_ACADEMIC_YEAR_KEY, String(year));
}

export async function clearActiveAcademicYear(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_ACADEMIC_YEAR_KEY);
}


