const STORAGE_KEY = 'kiit-time:selected-sections'

export function getSavedSectionIds(): number[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === 'number')) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSectionIds(ids: number[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}
