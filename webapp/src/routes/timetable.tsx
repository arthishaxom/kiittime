import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { motion, useMotionValue, animate } from 'motion/react'
import { Settings, Share2, RotateCcw, Mail, Megaphone, Smartphone } from 'lucide-react'
import { useTimetable } from '#/hooks/useTimetable'
import { useAnnouncement } from '#/hooks/useAnnouncement'
import type { Session } from '#/lib/api'
import { formatTime } from '#/lib/api'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '#/components/ui/sheet'
import { shareTimetable } from '#/lib/share'
import { buildMailto } from '#/lib/mailto'
import { AboutDialog } from '#/components/AboutDialog'
import { AnnouncementDialog } from '#/components/AnnouncementDialog'
import { isAnnouncementUnseen } from '#/lib/announcements'
import { getLastSeenAnnouncementId, setLastSeenAnnouncementId } from '#/lib/storage'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

const searchSchema = z.object({
  section_id: z
    .union([z.number(), z.array(z.number())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .catch([]),
})

export const Route = createFileRoute('/timetable')({
  validateSearch: searchSchema,
  component: TimetablePage,
})

function TimetablePage() {
  const { section_id } = Route.useSearch()
  const { data, isLoading, isError } = useTimetable(section_id)

  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const day of DAYS) map.set(day, [])
    for (const session of data?.sessions ?? []) {
      const key = session.day.toUpperCase().slice(0, 3)
      if (map.has(key)) {
        map.get(key)!.push(session)
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.period_number - b.period_number)
    }
    return map
  }, [data])

  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const { data: announcement } = useAnnouncement()
  const [lastSeenAnnouncementId, setLastSeenAnnouncementIdState] = useState<number | null>(() =>
    getLastSeenAnnouncementId(),
  )
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const announcementUnseen = isAnnouncementUnseen(
    announcement?.id ?? null,
    lastSeenAnnouncementId,
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on announcement?.id only — the full object changes identity on every staleTime:0 refetch, and including lastSeenAnnouncementId would reopen the dialog right after dismissal marks it seen
  useEffect(() => {
    if (announcement && isAnnouncementUnseen(announcement.id, lastSeenAnnouncementId)) {
      setAnnouncementOpen(true)
    }
  }, [announcement?.id])

  function handleMarkAnnouncementRead() {
    setAnnouncementOpen(false)
    if (announcement) {
      setLastSeenAnnouncementId(announcement.id)
      setLastSeenAnnouncementIdState(announcement.id)
    }
  }

  function handleReset() {
    localStorage.removeItem('kiit-time:selected-sections')
    navigate({ to: '/' })
  }

  const todayIndexRaw = new Date().getDay() === 0 ? 5 : new Date().getDay() - 1
  const initialIndex = Math.max(0, Math.min(DAYS.length - 1, todayIndexRaw))

  const [index, setIndex] = useState(initialIndex)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useLayoutEffect(() => {
    if (isLoading || isError) return

    function measure() {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth
        setContainerWidth(w)
        // Sync x to the initial day index so the carousel is not stuck at index 0 on mount
        x.set(-initialIndex * w)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isLoading, isError])

  const x = useMotionValue(0)

  const activeAnimation = useRef<ReturnType<typeof animate> | null>(null)

  function goTo(nextIndex: number) {
    const clamped = Math.max(0, Math.min(DAYS.length - 1, nextIndex))
    setIndex(clamped)
    const target = -clamped * containerWidth

    activeAnimation.current?.stop()
    activeAnimation.current = animate(x, target, {
      type: 'spring',
      stiffness: 400,
      damping: 40,
    })
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    const threshold = containerWidth * 0.2
    if (info.offset.x < -threshold) {
      goTo(index + 1)
    } else if (info.offset.x > threshold) {
      goTo(index - 1)
    } else {
      goTo(index) // snap back
    }
  }

  console.log('[timetable] RENDER — containerWidth:', containerWidth, 'index:', index)

  if (isLoading) {
    return <div className="h-dvh bg-bg text-text p-4">Loading timetable…</div>
  }

  if (isError) {
    return <div className="h-dvh bg-bg text-danger p-4">Failed to load timetable.</div>
  }

  return (
    <div className="h-dvh bg-bg text-text flex flex-col">
      <div className="p-4 pb-2 text-center">
        <h1 className="text-lg font-bold">{data?.sections_requested.join(', ')}</h1>
      </div>

      {/* Tab strip — all 6 days always shown, tapping scrolls the carousel */}
      <div className="flex gap-1 mx-4 mb-2 p-1 bg-surface rounded-lg">
        {DAYS.map((day, i) => (
          <button
            key={day}
            type="button"
            onClick={() => goTo(i)}
            className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${
              i === index ? 'bg-pill text-brand-active' : 'text-text-muted'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
        <motion.div
          className="flex h-full"
          style={{ x, touchAction: 'none' }}
          drag="x"
          dragConstraints={{ left: -(DAYS.length - 1) * containerWidth, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
        >
          {DAYS.map((day) => {
            const sessions = byDay.get(day) ?? []
            return (
              <div
                key={day}
                className="w-full h-full shrink-0 px-4 pb-4 overflow-y-auto flex flex-col"
                style={{ minWidth: '100%', touchAction: 'pan-y' }}
              >
                {sessions.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-text-muted">No Classes Today</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-2 pt-2">
                    {sessions.map((s, i) => (
                      <div
                        key={i}
                        className="bg-surface rounded-lg p-4 flex justify-between items-center"
                      >
                        <div>
                          <p className="text-brand text-2xl font-bold">{s.course_code}</p>
                          <p className="text-white text-lg">{s.room_number}</p>
                        </div>
                        <p className="text-white text-xl font-medium">{formatTime(s.start_time)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </motion.div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-surface border border-border flex items-center justify-center shadow-lg"
          >
            <Settings className="text-white" size={22} />
            {announcementUnseen && (
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-brand" />
            )}
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="bg-sheet border-border">
          <SheetHeader>
            <SheetTitle className="text-white text-center">Settings</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-4">
            {/android/i.test(navigator.userAgent) && (
              <a
                href="https://play.google.com/store/apps/details?id=com.ashish.kiittime"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-brand/20 to-brand/10 border border-brand/30"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand/20 flex items-center justify-center">
                    <Smartphone className="text-brand" size={24} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">Get the Android App</h3>
                    <p className="text-text-muted text-xs">For a faster, native experience</p>
                  </div>
                </div>
                <span className="bg-brand text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  Download
                </span>
              </a>
            )}
            
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => shareTimetable(section_id)}
                className="flex-1 h-16 rounded-lg bg-surface border border-border flex items-center justify-center gap-2 text-white font-medium"
              >
                <Share2 size={20} />
                Share
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 h-16 rounded-lg bg-danger/90 flex items-center justify-center gap-2 text-white font-medium"
              >
                <RotateCcw size={20} />
                Reset
              </button>
            </div>
            <a
              href={buildMailto({
                subject: 'KIIT Time - Contact',
                body: '',
              })}
              className="h-16 rounded-lg bg-surface border border-border flex items-center justify-center gap-2 text-white font-medium"
            >
              <Mail size={20} />
              Contact / Report an Issue
            </a>
            {announcement && (
              <button
                type="button"
                onClick={() => setAnnouncementOpen(true)}
                className="h-16 rounded-lg bg-surface border border-border flex items-center justify-center gap-2 text-white font-medium"
              >
                <Megaphone size={20} />
                Announcement
                {announcementUnseen && <span className="h-2 w-2 rounded-full bg-brand" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="h-16 rounded-lg bg-surface border border-border flex items-center justify-center gap-2 text-white font-medium"
            >
              About
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      {announcement && (
        <AnnouncementDialog
          announcement={announcement}
          open={announcementOpen}
          onOpenChange={setAnnouncementOpen}
          onMarkAsRead={handleMarkAnnouncementRead}
          unseen={announcementUnseen}
        />
      )}
    </div>
  )
}
