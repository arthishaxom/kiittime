import { isAnnouncementUnseen } from '@/lib/announcements';

describe('isAnnouncementUnseen', () => {
  it('is false when there is no active announcement', () => {
    expect(isAnnouncementUnseen(null, null)).toBe(false);
    expect(isAnnouncementUnseen(null, 5)).toBe(false);
  });

  it('is true when nothing has been seen yet', () => {
    expect(isAnnouncementUnseen(1, null)).toBe(true);
  });

  it('is true when the current announcement differs from the last seen one', () => {
    expect(isAnnouncementUnseen(2, 1)).toBe(true);
  });

  it('is false when the current announcement matches the last seen one', () => {
    expect(isAnnouncementUnseen(1, 1)).toBe(false);
  });
});
