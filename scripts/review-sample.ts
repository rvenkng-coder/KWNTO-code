// Decides whether a task built by a local model needs a review at close (docs/developer/review-sampling.md).
export const SENSITIVE: RegExp[] = [
  /^backend\/pb_migrations\//i,
  /^backend\/pb_hooks\//i,
  /^tests\/rules\//i,
  /^frontend\/src\/backend\//i,
  /sync|conflict|queue/i,
]

export interface ReviewInput {
  changedFiles: string[]
  taskNumber: number
  builtBy: 'local' | 'strong'
  escapeRate: number // in [0, 1]
}

const ESCAPE_LIMIT = 0.25

function normalise(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

export function needsReview(input: ReviewInput): { required: boolean; reason: string } {
  const result = decide(input)
  // An empty list may mean the diff could not be read; the rules above still apply, and the reason says so.
  return input.changedFiles.length === 0 && input.builtBy === 'local'
    ? { ...result, reason: `nothing changed; ${result.reason}` }
    : result
}

function decide(input: ReviewInput): { required: boolean; reason: string } {
  if (input.builtBy === 'strong') {
    return { required: false, reason: "built by a strong model; the plan's own per-task review applies" }
  }
  const files = input.changedFiles.map(normalise)
  const sensitive = files.find((file) => SENSITIVE.some((pattern) => pattern.test(file)))
  if (sensitive !== undefined) return { required: true, reason: `touches ${sensitive}, a sensitive path` }
  // Fail closed: a rate outside [0, 1] (NaN included) is treated as too high to trust.
  const rateOk = input.escapeRate >= 0 && input.escapeRate <= 1
  if (!rateOk || input.escapeRate > ESCAPE_LIMIT) {
    return {
      required: true,
      reason: `escape rate ${input.escapeRate} is above ${ESCAPE_LIMIT}; every local task is reviewed`,
    }
  }
  const sampled = Number.isInteger(input.taskNumber) && input.taskNumber > 0 && input.taskNumber % 3 === 0
  if (sampled) return { required: true, reason: `task ${input.taskNumber} is in the sample (1 in 3)` }
  return { required: false, reason: 'not in the sample (1 in 3)' }
}
