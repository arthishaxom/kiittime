import type { Session } from '@kiittime/api/api';

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export type Day = (typeof DAYS)[number];

export function groupSessionsByDay(sessions: Session[]): Map<Day, Session[]> {
  const map = new Map<Day, Session[]>();
  for (const day of DAYS) map.set(day, []);

  for (const s of sessions) {
    const key = s.day.toUpperCase().slice(0, 3) as Day;
    if (map.has(key)) {
      map.get(key)!.push(s);
    }
  }

  for (const list of map.values()) {
    list.sort((a, b) => a.period_number - b.period_number);
  }

  return map;
}

export function todayIndex(): number {
  const jsDay = new Date().getDay(); // Sun=0..Sat=6
  const raw = jsDay === 0 ? 5 : jsDay - 1; // Sunday folds to Sat's index
  return Math.max(0, Math.min(DAYS.length - 1, raw));
}
