import AsyncStorage from '@react-native-async-storage/async-storage';
<<<<<<< HEAD
<<<<<<< HEAD
import {
  clearSavedSectionIds,
  getLastSeenAnnouncementId,
  getSavedSectionIds,
  saveSectionIds,
  setLastSeenAnnouncementId,
} from '@/lib/storage';
=======
import { clearSavedSectionIds, getSavedSectionIds, saveSectionIds } from '@/lib/storage';
>>>>>>> origin/dev
=======
import { clearSavedSectionIds, getSavedSectionIds, saveSectionIds } from '@/lib/storage';
>>>>>>> origin/main

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
<<<<<<< HEAD
<<<<<<< HEAD

describe('setLastSeenAnnouncementId / getLastSeenAnnouncementId round-trip', () => {
  it('returns the previously seen announcement id', async () => {
    await setLastSeenAnnouncementId(42);
    await expect(getLastSeenAnnouncementId()).resolves.toBe(42);
  });

  it('returns null when nothing has been seen', async () => {
    await expect(getLastSeenAnnouncementId()).resolves.toBeNull();
  });

  it('returns null for unparseable JSON', async () => {
    await AsyncStorage.setItem('kiit-time:last-seen-announcement', 'not json');
    await expect(getLastSeenAnnouncementId()).resolves.toBeNull();
  });
});
=======
>>>>>>> origin/dev
=======
>>>>>>> origin/main
