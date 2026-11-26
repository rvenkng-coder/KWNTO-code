import PocketBase from 'pocketbase'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createProjectFiles, MAX_IMPORT_BYTES } from './projectFiles.ts'

const TOO_LARGE = 'This file is larger than the 5 MB import limit.'

function jsonReply(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('project files door', () => {
  // Protects security.md 5 "Bad imports" (C7): a file over 5 MB is refused with the router's
  // copy before any request is sent; a small one is sent as the raw body to the team's import
  // route and the new project's id is returned.
  test('the door refuses large files and returns the new project', async () => {
    const fetchMock = vi.fn(async () => jsonReply({ projectId: 'p' }))
    vi.stubGlobal('fetch', fetchMock)
    const files = createProjectFiles(new PocketBase('http://pb.test'))

    const big = new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], 'big.kwnto.json')
    await expect(files.importFile('team1', big)).rejects.toThrow(TOO_LARGE)
    expect(fetchMock).not.toHaveBeenCalled()

    const small = new File(['{"format":"kwnto-project"}'], 'story.kwnto.json')
    expect(await files.importFile('team1', small)).toBe('p')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://pb.test/api/kwnto/teams/team1/import')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"format":"kwnto-project"}')

    // A file of exactly the limit is allowed.
    const exact = new File([new Uint8Array(MAX_IMPORT_BYTES)], 'exact.kwnto.json')
    expect(await files.importFile('team1', exact)).toBe('p')
  })

  // Protects design 10: the download is the server's file, readable (indented), named by the
  // server's Content-Disposition; an unknown project is a not-found error with the server's text.
  test("the door downloads the file under the server's name", async () => {
    const fetchMock = vi.fn(async () =>
      jsonReply({ format: 'kwnto-project' }, { 'content-disposition': 'attachment; filename="My-story.kwnto.json"' }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const files = createProjectFiles(new PocketBase('http://pb.test'))
    const { name, blob } = await files.download('p1')
    expect(name).toBe('My-story.kwnto.json')
    expect(await blob.text()).toBe('{\n  "format": "kwnto-project"\n}')

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'No project with this id.' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(files.download('nope')).rejects.toMatchObject({
      kind: 'not-found',
      message: 'No project with this id.',
    })
  })
})
