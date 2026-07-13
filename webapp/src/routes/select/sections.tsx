import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useSections } from '#/hooks/useSections'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { saveSectionIds } from '#/lib/storage'

const searchSchema = z.object({
  year: z.number().int().min(1).max(4).catch(1),
})

export const Route = createFileRoute('/select/sections')({
  validateSearch: searchSchema,
  component: SectionSearch,
})

function SectionSearch() {
  const { year } = Route.useSearch()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const { data: sections, isLoading, isError } = useSections(year)

  const filtered = useMemo(() => {
    if (!sections) return []
    const q = search.trim().toLowerCase()
    if (!q) return sections
    return sections.filter((s) => s.section_name.toLowerCase().includes(q))
  }, [sections, search])

  const selectedSections = useMemo(
    () => sections?.filter((s) => selectedIds.includes(s.id)) ?? [],
    [sections, selectedIds],
  )

  function toggleSection(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col p-4">
      <div className="flex items-center gap-3 mb-4">
        <button type="button" onClick={() => navigate({ to: '/' })} className="text-2xl">
          ←
        </button>
        <h1 className="text-xl font-bold flex-1 text-center">Select Sections</h1>
        <button
          type="button"
          disabled={selectedIds.length === 0}
          onClick={() => {
            saveSectionIds(selectedIds)
            navigate({
              to: '/timetable',
              search: { section_id: selectedIds },
            })
          }}
          className="text-brand font-semibold disabled:opacity-40 disabled:pointer-events-none"
        >
          Done
        </button>
      </div>

      <Input
        placeholder="Search sections…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />

      {selectedSections.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-text-muted mb-2">
            Selected Sections ({selectedSections.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedSections.map((s) => (
              <Badge key={s.id} className="cursor-pointer" onClick={() => toggleSection(s.id)}>
                {s.section_name} ×
              </Badge>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-text-muted mb-2">Available Sections (Year {year})</p>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {isLoading && <p className="text-text-muted text-sm">Loading sections…</p>}
        {isError && <p className="text-danger text-sm">Failed to load sections.</p>}
        {!isLoading && !isError && filtered.length === 0 && (
          <p className="text-text-muted text-sm">No sections found. Try adjusting your search.</p>
        )}
        {filtered.map((s) => {
          const isSelected = selectedIds.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSection(s.id)}
              className={`h-14 rounded-lg px-4 text-left font-medium transition-colors ${
                isSelected ? 'bg-brand text-white' : 'bg-surface text-text border border-border'
              }`}
            >
              {s.section_name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
