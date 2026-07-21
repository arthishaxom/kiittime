import { DAYS, groupSessionsByDay } from '@/lib/timetable';
import type { Session } from '@/lib/api';

function session(overrides: Partial<Session>): Session {
  return {
    day: 'Monday',
    period_number: 1,
    start_time: '09:00:00',
    course_code: 'CS101',
    course_name: null,
    faculty_name: 'Dr. Test',
    room_number: '101',
    section: 'CSE-1',
    ...overrides,
  };
}

describe('groupSessionsByDay', () => {
  it('returns a map with every day present and empty for no sessions', () => {
    const grouped = groupSessionsByDay([]);
    for (const day of DAYS) {
      expect(grouped.get(day)).toEqual([]);
    }
  });

  it('buckets sessions under their day, case-insensitively', () => {
    const mon = session({ day: 'monday', period_number: 1 });
    const tue = session({ day: 'TUESDAY', period_number: 1 });

    const grouped = groupSessionsByDay([mon, tue]);

    expect(grouped.get('MON')).toEqual([mon]);
    expect(grouped.get('TUE')).toEqual([tue]);
    expect(grouped.get('WED')).toEqual([]);
  });

  it('sorts sessions within a day by period_number ascending', () => {
    const third = session({ day: 'Monday', period_number: 3, course_code: 'THIRD' });
    const first = session({ day: 'Monday', period_number: 1, course_code: 'FIRST' });
    const second = session({ day: 'Monday', period_number: 2, course_code: 'SECOND' });

    const grouped = groupSessionsByDay([third, first, second]);

    expect(grouped.get('MON')?.map((s) => s.course_code)).toEqual(['FIRST', 'SECOND', 'THIRD']);
  });

  it('ignores sessions for days outside Mon-Sat', () => {
    const sunday = session({ day: 'Sunday' });
    const grouped = groupSessionsByDay([sunday]);

    for (const day of DAYS) {
      expect(grouped.get(day)).toEqual([]);
    }
  });
});
