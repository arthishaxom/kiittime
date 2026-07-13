export async function shareTimetable() {
  const url = window.location.href
  const shareData = {
    title: 'My KIIT Time Timetable',
    text: 'Check out my class schedule',
    url,
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
