export async function shareTimetable(sectionIds: number[]) {
  const url = new URL('/timetable', window.location.origin)
  for (const id of sectionIds) {
    url.searchParams.append('section_id', String(id))
  }
  
  const shareData = {
    title: 'My KIIT Time Timetable',
    text: `Check out my class schedule\n${url.toString()}\n\nGet the Android app: https://play.google.com/store/apps/details?id=com.ashish.kiittime`,
    url: url.toString(),
  }

  if (navigator.share) {
    try {
      await navigator.share(shareData)
    } catch {
      // user cancelled the share sheet — not an error, do nothing
    }
    return
  }

  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
