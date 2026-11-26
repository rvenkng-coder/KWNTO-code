// Asks the local model server (llama-swap) whether it answers and whether the model is loaded.
// node scripts/ping-local-model.ts [baseUrl]   (default http://localhost:9092)
// GET <baseUrl>/running only: never a prompt, and a response body is never printed.
// Exit 0 if the server answers (loaded or idle), 1 if it does not, 2 for a bad argument.
import { isMain } from './lib/is-main.ts'

export interface PingResult {
  ok: boolean
  loaded: boolean
  detail: string
}

export const DEFAULT_URL = 'http://localhost:9092'
const DEFAULT_TIMEOUT_MS = 3000
const KNOWN_STATES = ['ready', 'starting', 'stopping', 'stopped', 'shutdown']
const NOT_UNDERSTOOD = 'the /running answer was not understood'

// llama-swap answers {"running":[{"model":"coder","state":"ready"}]}. A bare array of the same entries is
// accepted too. A model is loaded only when an entry says "ready"; anything unreadable counts as not loaded.
export function readRunning(body: unknown): { loaded: boolean; understood: boolean } {
  const list = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.running) ? body.running : null
  if (list === null) return { loaded: false, understood: false }
  // The model name is not checked: any entry in the ready state counts. An unrecognised state word is not understood.
  const states = list.map((entry) => {
    const state = isRecord(entry) && typeof entry.state === 'string' ? entry.state.toLowerCase() : null
    return state !== null && KNOWN_STATES.includes(state) ? state : null
  })
  if (states.includes('ready')) return { loaded: true, understood: true }
  return { loaded: false, understood: !states.includes(null) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 200)
}

function failureDetail(error: unknown): string {
  const cause = error instanceof Error && isRecord(error.cause) ? error.cause : null
  const code = cause && typeof cause.code === 'string' ? cause.code : ''
  if (code === 'ECONNREFUSED') return 'connection refused (is the server running?)'
  const message = error instanceof Error ? error.message : 'unknown error'
  // undici puts the whole request URL (credentials included) in its messages: never print one.
  return oneLine(`no answer: ${code ? `${code} ` : ''}${message.replace(/[a-z][a-z0-9+.-]*:\/\/\S*/gi, '<url>')}`)
}

async function ask(url: string, fetchFn: typeof fetch, signal: AbortSignal): Promise<PingResult> {
  const response = await fetchFn(url, { method: 'GET', signal, redirect: 'manual' })
  if (response.status < 200 || response.status > 299) {
    return { ok: false, loaded: false, detail: `the server answered status ${response.status}` }
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: true, loaded: false, detail: NOT_UNDERSTOOD }
  }
  const { loaded, understood } = readRunning(body)
  if (!understood) return { ok: true, loaded: false, detail: NOT_UNDERSTOOD }
  return { ok: true, loaded, detail: loaded ? 'model loaded' : 'model idle (loads on the first request)' }
}

export async function pingModelServer(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<PingResult> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<PingResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve({ ok: false, loaded: false, detail: `no answer within ${timeoutMs} ms` })
    }, timeoutMs)
  })
  try {
    return await Promise.race([ask(`${baseUrl.replace(/\/+$/, '')}/running`, fetchFn, controller.signal), timeout])
  } catch (error) {
    return { ok: false, loaded: false, detail: failureDetail(error) }
  } finally {
    clearTimeout(timer)
  }
}

export function formatPing(result: PingResult): string {
  if (!result.ok) return `model server: NOT answering: ${result.detail}`
  if (result.loaded) return 'model server: answering, model loaded'
  const idle = 'model server: answering, model idle (loads on the first request)'
  return result.detail === NOT_UNDERSTOOD ? `${idle}; ${NOT_UNDERSTOOD}` : idle
}

// The base URL from the arguments, or an error message. The messages are fixed text: the argument is never
// echoed, because it can carry a password. Anything starting with "-" is a mistake, not an option.
export function parseArgs(args: string[]): { url: string } | { error: string } {
  const usage = 'usage: node scripts/ping-local-model.ts [baseUrl]'
  if (args.length > 1) return { error: usage }
  const url = args[0] ?? DEFAULT_URL
  if (url.startsWith('-')) return { error: `unknown option; ${usage}` }
  try {
    const parsed = new URL(url)
    if (parsed.username !== '' || parsed.password !== '')
      return { error: 'baseUrl must not contain a user name or password' }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return { url }
  } catch {
    // falls through to the message below
  }
  return { error: 'baseUrl must be an http or https URL' }
}

export async function runPing(
  args: string[],
  fetchFn: typeof fetch = fetch,
  timeoutMs?: number,
): Promise<{ code: number; line: string }> {
  const parsed = parseArgs(args)
  if ('error' in parsed) return { code: 2, line: parsed.error }
  const result = await pingModelServer(parsed.url, fetchFn, timeoutMs)
  return { code: result.ok ? 0 : 1, line: formatPing(result) }
}

if (isMain(import.meta.filename)) {
  const { code, line } = await runPing(process.argv.slice(2))
  console.log(line)
  process.exit(code)
}
