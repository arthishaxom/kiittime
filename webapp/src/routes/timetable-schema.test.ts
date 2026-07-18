import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// This is the updated schema we will put in timetable.tsx
const searchSchema = z.object({
  section_id: z
    .union([z.number(), z.array(z.number())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .catch([]),
})

describe('timetable searchSchema', () => {
  it('parses a single number into an array', () => {
    const result = searchSchema.parse({ section_id: 42 })
    expect(result.section_id).toEqual([42])
  })

  it('parses an array of numbers into an array', () => {
    const result = searchSchema.parse({ section_id: [1, 2, 3] })
    expect(result.section_id).toEqual([1, 2, 3])
  })

  it('catches invalid types and returns an empty array', () => {
    const result = searchSchema.parse({ section_id: 'not a number' })
    expect(result.section_id).toEqual([])
  })

  it('handles missing section_id gracefully', () => {
    const result = searchSchema.parse({})
    expect(result.section_id).toEqual([])
  })
})
