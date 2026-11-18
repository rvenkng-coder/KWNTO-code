import type { ScriptLine } from '../../../backend'

export const SUGGESTION_LIMIT = 8

export function characterSuggestions(lines: ScriptLine[], typed: string, limit = SUGGESTION_LIMIT): string[] {
  const typedKey = typed.trim().toLowerCase()

  // Build a map: lowercase name → { firstSpelling, count }
  const nameMap = new Map<string, { spelling: string; count: number }>()

  for (const line of lines) {
    const trimmed = line.character.trim()
    if (trimmed === '') continue
    const lower = trimmed.toLowerCase()
    const entry = nameMap.get(lower)
    if (entry) {
      entry.count += 1
    } else {
      nameMap.set(lower, { spelling: trimmed, count: 1 })
    }
  }

  // Filter by prefix, exclude exact match
  const candidates: string[] = []
  for (const [key, { spelling }] of nameMap) {
    if (key.startsWith(typedKey) && key !== typedKey) {
      candidates.push(spelling)
    }
  }

  // Sort: most used first, then alphabetical for ties
  candidates.sort((a, b) => {
    const countA = nameMap.get(a.toLowerCase())!.count
    const countB = nameMap.get(b.toLowerCase())!.count
    if (countB !== countA) return countB - countA
    return a.localeCompare(b)
  })

  return candidates.slice(0, limit)
}
