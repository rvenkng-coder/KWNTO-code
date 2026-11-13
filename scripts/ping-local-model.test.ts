// Protects the local-model runbook's first step: a server that does not answer, or an idle model, is reported
// (never a silent stall), only a GET is ever sent, and an answer that is not understood counts as not loaded.
import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { type AddressInfo } from 'node:net'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { formatPing, parseArgs, pingModelServer, readRunning, runPing } from './ping-local-model.ts'

const SCRIPT = join(import.meta.dirname, 'ping-local-model.ts')
const answer = (status: number, body: string): typeof fetch => async () => new Response(body, { status })

describe('pingModelServer', () => {
  // Protects: a 200 with a running model is ok and loaded.
  test('a 200 with a running model is ok and loaded', async () => {
    const result = await pingModelServer('http://x', answer(200, '{"running":[{"model":"coder","state":"ready"}]}'))
    expect(result).toMatchObject({ ok: true, loaded: true })
  })

  // Protects: a bare array with a ready model is ok and loaded.
  test('a bare array with a ready model is ok and loaded', async () => {
    expect(await pingModelServer('http://x', answer(200, '[{"model":"coder","state":"ready"}]'))).toMatchObject({ ok: true, loaded: true })
  })

  // Protects: a 200 with an empty running list is ok and idle.
  test('a 200 with an empty running list is ok and idle', async () => {
    expect(await pingModelServer('http://x', answer(200, '{"running":[]}'))).toMatchObject({ ok: true, loaded: false })
    expect(await pingModelServer('http://x', answer(200, '[]'))).toMatchObject({ ok: true, loaded: false })
  })

  // Protects: loaded false means idle: a model that is still starting is not loaded.
  test('loaded false means idle: a model that is still starting is not loaded', async () => {
    const result = await pingModelServer('http://x', answer(200, '{"running":[{"model":"coder","state":"starting"}]}'))
    expect(result).toMatchObject({ ok: true, loaded: false })
    expect(result.detail).toMatch(/idle/)
  })

  // Protects: a 500 is not ok and says the status.
  test('a 500 is not ok and says the status', async () => {
    const result = await pingModelServer('http://x', answer(500, 'secret body'))
    expect(result.ok).toBe(false)
    expect(result.detail).toContain('500')
    expect(result.detail).not.toContain('secret')
  })

  // Protects: a redirect is not ok and is not followed.
  test('a redirect is not ok and is not followed', async () => {
    const result = await pingModelServer('http://x', async () => new Response(null, { status: 302, headers: { location: 'http://evil' } }))
    expect(result).toMatchObject({ ok: false })
    expect(result.detail).toContain('302')
  })

  // Protects: a connection refused is not ok and says so.
  test('a connection refused is not ok and says so', async () => {
    const refused: typeof fetch = async () => {
      throw new TypeError('fetch failed', { cause: Object.assign(new Error('connect'), { code: 'ECONNREFUSED' }) })
    }
    const result = await pingModelServer('http://x', refused)
    expect(result.ok).toBe(false)
    expect(result.detail).toMatch(/refused/)
  })

  // Protects: no answer within the timeout is not ok.
  test('no answer within the timeout is not ok', async () => {
    const never: typeof fetch = () => new Promise<Response>(() => {})
    const result = await pingModelServer('http://x', never, 50)
    expect(result.ok).toBe(false)
    expect(result.detail).toContain('50 ms')
  })

  // Protects: invalid JSON in a 200 answer is ok but reports loaded unknown as idle and says the answer .
  test('invalid JSON in a 200 answer is ok but reports loaded unknown as idle and says the answer was not understood', async () => {
    const result = await pingModelServer('http://x', answer(200, '<html>not json</html>'))
    expect(result).toMatchObject({ ok: true, loaded: false })
    expect(result.detail).toMatch(/not understood/)
  })

  // Protects: an answer of an unexpected shape is ok, idle and not understood.
  test('an answer of an unexpected shape is ok, idle and not understood', async () => {
    for (const body of ['"ready"', '42', 'null', '{}', '{"running":"ready"}', '{"running":[{"model":"coder"}]}', '[null]', '[{"state":7}]']) {
      const result = await pingModelServer('http://x', answer(200, body))
      expect(result, body).toMatchObject({ ok: true, loaded: false })
      expect(result.detail, body).toMatch(/not understood/)
    }
  })

  // Protects: a ready model wins over an entry that cannot be read.
  test('a ready model wins over an entry that cannot be read', () => {
    expect(readRunning([{ foo: 1 }, { state: 'ready' }])).toEqual({ loaded: true, understood: true })
  })

  // Protects: only GET is asked, with no body, and the path is /running.
  test('only GET is asked, with no body, and the path is /running', async () => {
    const seen: { url: string; init?: RequestInit }[] = []
    const spy: typeof fetch = async (input, init) => {
      seen.push({ url: String(input), init })
      return new Response('[]')
    }
    await pingModelServer('http://host:1/', spy)
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe('http://host:1/running')
    expect(seen[0].init?.method).toBe('GET')
    expect(seen[0].init?.body).toBeUndefined()
  })
})

describe('arguments and the line', () => {
  // Protects: no argument uses the default address; an http or https URL is accepted.
  test('no argument uses the default address; an http or https URL is accepted', () => {
    expect(parseArgs([])).toEqual({ url: 'http://localhost:9092' })
    expect(parseArgs(['https://h:1'])).toEqual({ url: 'https://h:1' })
  })

  // Protects: a baseUrl that is not an http(s) URL, starts with a dash or comes with extras is a usage e.
  test('a baseUrl that is not an http(s) URL, starts with a dash or comes with extras is a usage error', () => {
    for (const args of [['ftp://h'], ['localhost:9092'], ['not a url'], [''], ['--help'], ['-x'], ['file:///etc/passwd'], ['http://a', 'http://b']]) {
      expect(parseArgs(args), args.join(' ')).toHaveProperty('error')
    }
  })

  // Protects: the lines are the three forms and never the body.
  test('the lines are the three forms and never the body', async () => {
    expect(formatPing({ ok: true, loaded: true, detail: 'x' })).toBe('model server: answering, model loaded')
    expect(formatPing({ ok: true, loaded: false, detail: 'x' })).toBe('model server: answering, model idle (loads on the first request)')
    expect(formatPing({ ok: false, loaded: false, detail: 'refused' })).toBe('model server: NOT answering: refused')
    const run = await runPing(['http://x'], answer(200, 'SECRET not json'))
    expect(run.code).toBe(0)
    expect(run.line).not.toContain('SECRET')
    expect(run.line).not.toContain('\n')
  })
})

describe('the command', () => {
  let server: Server | null = null
  afterEach(() => { server?.close(); server = null })

  function serve(status: number, body: string): Promise<{ base: string; methods: string[] }> {
    const methods: string[] = []
    server = createServer((req, res) => {
      methods.push(`${req.method} ${req.url}`)
      res.writeHead(status).end(body)
    })
    return new Promise((resolve) => {
      server!.listen(0, '127.0.0.1', () => resolve({ base: `http://127.0.0.1:${(server!.address() as AddressInfo).port}`, methods }))
    })
  }
  // Async spawn: the throwaway server lives in this process, so a blocking spawn would starve it.
  const run = (...args: string[]) => new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString() })
    child.on('close', (code) => resolve({ code, out }))
  })

  // Protects: the command exits 0 when answering and 1 when not.
  test('the command exits 0 when answering and 1 when not', async () => {
    const { base } = await serve(200, '{"running":[{"model":"coder","state":"ready"}]}')
    const up = await run(base)
    expect(up.code).toBe(0)
    expect(up.out).toBe('model server: answering, model loaded\n')
    server?.close()
    const down = await run(base)
    expect(down.code).toBe(1)
    expect(down.out).toMatch(/^model server: NOT answering: .*\n$/)
  })

  // Protects: only GET is sent.
  test('only GET is sent', async () => {
    const { base, methods } = await serve(200, '[]')
    await run(base)
    expect(methods).toEqual(['GET /running'])
  })

  // Protects: a bad baseUrl exits 2 with a message and no ping.
  test('a bad baseUrl exits 2 with a message and no ping', async () => {
    const bad = await run('--force')
    expect(bad.code).toBe(2)
    expect(bad.out).toMatch(/unknown option/)
    const notUrl = await run('localhost:9092')
    expect(notUrl.code).toBe(2)
    expect(notUrl.out).toMatch(/http or https/)
  })
})
