import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'kiit-time:selected-sections';

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
