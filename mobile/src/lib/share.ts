import { Share } from 'react-native';

const WEBAPP_URL = 'https://kiittime.vercel.app';

export function buildShareUrl(sectionIds: number[]): string {
  const url = new URL('/timetable', WEBAPP_URL);
  for (const id of sectionIds) {
    url.searchParams.append('section_id', String(id));
  }
  return url.toString();
}

export function buildShareMessage(sectionIds: number[]): string {
  return `Check out my class schedule\n${buildShareUrl(sectionIds)}`;
}

export async function shareTimetable(sectionIds: number[]): Promise<void> {
  try {
    await Share.share({
      title: 'My KIIT Time Timetable',
      message: buildShareMessage(sectionIds),
      url: buildShareUrl(sectionIds),
    });
  } catch {
    // thrown or cancelled — fail silently, no error surfaced to the user
  }
}
