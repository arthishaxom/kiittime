import { ChevronRight, Info } from 'lucide-react'
import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { getSavedSectionIds } from '#/lib/storage'
import { AboutDialog } from '#/components/AboutDialog'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const saved = getSavedSectionIds()
    if (saved && saved.length > 0) {
      throw redirect({ to: '/timetable', search: { section_id: saved } })
    }
  },
  component: Landing,
})

function Landing() {
  const [year, setYear] = useState<number | undefined>(undefined)
  const [aboutOpen, setAboutOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="h-dvh bg-bg/50 text-text flex flex-col p-6">
      {/* Logo */}
      <div className="flex-1 flex items-center justify-center">
        <img src="/logo.png" alt="KIIT Time" className="w-4/5 max-w-70 h-25 object-contain" />
      </div>

      {/* Card */}
      <div className="bg-surface rounded-[15px] p-8">
        <p className="text-white font-semibold text-lg mb-1">Find by Section</p>

        <p className="text-text-muted text-sm mb-2 mt-4">Year</p>
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`flex-1 h-14 rounded-lg text-lg font-medium border-2 transition-colors ${
                year === y
                  ? 'bg-brand text-white border-brand'
                  : 'bg-transparent text-text border-border hover:border-text-muted'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate({ to: '/select/sections', search: { year: year! } })}
          disabled={!year}
          className="w-full h-14 rounded-lg border border-border flex items-center justify-between px-4 text-lg disabled:opacity-40 disabled:pointer-events-none"
        >
          <span className={year ? 'text-white' : 'text-text-muted'}>
            {year ? 'Select sections' : 'Select year first'}
          </span>
          <ChevronRight size={20} className="text-white" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setAboutOpen(true)}
        className="mt-4 flex items-center justify-center gap-2 text-text-muted text-sm"
      >
        <Info size={16} />
        About
      </button>

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  )
}
