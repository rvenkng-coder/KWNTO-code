/** The one or two capital letters that stand for a person: "Mara Lin" is ML, "mara" is M. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w !== '')
  const letters = words.length >= 2 ? [words[0], words[words.length - 1]] : [words[0] ?? '?']
  return letters.map((w) => Array.from(w as string)[0] ?? '').join('').toUpperCase()
}
