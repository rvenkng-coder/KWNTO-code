/** "just now", "5 minutes ago", "3 days ago"; '' when `iso` is not a date. `now` is a parameter so it can be tested. */
export function ago(iso: string | undefined, now: number = Date.now()): string {
  const then = iso === undefined || iso === '' ? NaN : Date.parse(iso.replace(' ', 'T'))
  if (Number.isNaN(then)) return ''
  const minutes = Math.floor(Math.max(0, now - then) / 60000)
  if (minutes < 1) return 'just now'
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'} ago`
  if (minutes < 60) return unit(minutes, 'minute')
  if (minutes < 60 * 24) return unit(Math.floor(minutes / 60), 'hour')
  if (minutes < 60 * 24 * 30) return unit(Math.floor(minutes / (60 * 24)), 'day')
  if (minutes < 60 * 24 * 365) return unit(Math.floor(minutes / (60 * 24 * 30)), 'month')
  return unit(Math.floor(minutes / (60 * 24 * 365)), 'year')
}
