import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSavedSectionIds, getSavedSectionIds, saveSectionIds } from '@/lib/storage';

afterEach(async () => {
  await AsyncStorage.clear();
});

describe('saveSectionIds / getSavedSectionIds round-trip', () => {
  it('returns previously saved ids', async () => {
    await saveSectionIds([1, 2, 3]);
    await expect(getSavedSectionIds()).resolves.toEqual([1, 2, 3]);
  });

  it('returns null when nothing has been saved', async () => {
    await expect(getSavedSectionIds()).resolves.toBeNull();
  });
});

describe('getSavedSectionIds malformed-data fallback', () => {
  it('returns null for non-array JSON', async () => {
    await AsyncStorage.setItem('kiit-time:selected-sections', JSON.stringify({ foo: 'bar' }));
    await expect(getSavedSectionIds()).resolves.toBeNull();
  });

  it('returns null for an array containing non-numbers', async () => {
    await AsyncStorage.setItem('kiit-time:selected-sections', JSON.stringify([1, 'two', 3]));
    await expect(getSavedSectionIds()).resolves.toBeNull();
  });

  it('returns null for unparseable JSON', async () => {
    await AsyncStorage.setItem('kiit-time:selected-sections', 'not json');
    await expect(getSavedSectionIds()).resolves.toBeNull();
  });
});

describe('clearSavedSectionIds', () => {
  it('removes the saved ids', async () => {
    await saveSectionIds([1, 2]);
    await clearSavedSectionIds();
    await expect(getSavedSectionIds()).resolves.toBeNull();
  });
});
