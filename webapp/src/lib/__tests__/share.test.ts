import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shareTimetable } from '../share'

describe('shareTimetable', () => {
  const originalLocation = window.location
  const originalNavigatorShare = navigator.share
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://kiittime.apothal.dev',
      },
      writable: true,
    })

    // Mock navigator.share
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockResolvedValue(undefined),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation })
    Object.defineProperty(navigator, 'share', { value: originalNavigatorShare })
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard })
    vi.clearAllMocks()
  })

  it('builds a standard share URL with repeating section_id query parameters', async () => {
    // We expect shareTimetable to now take an array of numbers
    await shareTimetable([12, 34])

    // Verify navigator.share was called with the correctly formatted URL
    expect(navigator.share).toHaveBeenCalledWith({
      title: 'My KIIT Time Timetable',
      text: 'Check out my class schedule\nhttps://kiittime.apothal.dev/timetable?section_id=12&section_id=34\n\nGet the Android app: https://play.google.com/store/apps/details?id=com.ashish.kiittime',
      url: 'https://kiittime.apothal.dev/timetable?section_id=12&section_id=34',
    })
  })
})
