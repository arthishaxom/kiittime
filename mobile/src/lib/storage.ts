import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'kiit-time:selected-sections';
<<<<<<< HEAD
<<<<<<< HEAD
const LAST_SEEN_ANNOUNCEMENT_KEY = 'kiit-time:last-seen-announcement';
=======
>>>>>>> origin/dev
=======
>>>>>>> origin/main

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
<<<<<<< HEAD
<<<<<<< HEAD

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
=======
>>>>>>> origin/dev
=======
>>>>>>> origin/main
