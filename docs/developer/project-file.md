# The project file

A project can be exported to and imported from one JSON file (design 10, [plan 7](../superpowers/plans/2026-11-20-sharing/README.md) D3 to D6). The file is built and checked **only on the server**, in [lib/project-file.js](../../backend/pb_hooks/lib/project-file.js): export, import, snapshots and the shared view use the same builder and the same validator. The browser only downloads and uploads the file. A file is untrusted input ([security.md](../security.md) section 5, "Bad imports").

## The format (version 1)

```json
{
  "format": "kwnto-project",
  "version": 1,
  "exportedAt": "2026-11-20 10:00:00.000Z",
  "project": { "name": "My story", "startNode": "n1" },
  "chapters": [{ "id": "c1", "title": "Chapter 1", "position": 1 }],
  "nodes": [{ "id": "n1", "chapter": "c1", "title": "Opening", "color": "slate", "x": 0, "y": 0, "width": 320, "height": 240, "cover": "m2" }],
  "lines": [{ "id": "l1", "node": "n1", "character": "Mara", "text": "Hello.", "sortOrder": 1 }],
  "cues": [{ "id": "q1", "node": "n1", "type": "audio", "text": "rain", "sortOrder": 1 }],
  "connections": [{ "id": "k1", "from": "n1", "to": null, "label": "Leave" }],
  "media": [{ "id": "m1", "node": "n1", "title": "Theme", "kind": "audio" }, { "id": "m2", "node": "n1", "title": "Stage", "kind": "image" }],
  "links": [{ "id": "u1", "node": "n1", "title": "Trailer", "url": "https://example.com/v" }]
}
```

| Field | Type | Notes |
|---|---|---|
| `format`, `version` | `"kwnto-project"`, `1` | Fixed. |
| `exportedAt` | string | Optional when importing; export writes the server's time. |
| `project.name` | string, 1 to 120 | |
| `project.startNode` | node id or `null` | Must be a node of the file. |
| `chapters[].title` | string, 1 to 120 | `position` is a number (tab order). |
| `nodes[].chapter` | chapter id | A chapter of the file. |
| `nodes[].title` | string, up to 200 | `color` is one of `slate, red, orange, amber, green, teal, blue, purple`; `x`, `y` are numbers. |
| `nodes[].width`, `height` | number, 0 to 2000, optional | The card's own size. Left out for the default size. |
| `nodes[].cover` | media id, optional | The node's cover image, one of `media[]`. Share views show it; **import ignores it**, because the image is not in the file. |
| `lines[].node` | node id | `character` up to 80, `text` up to 5000, `sortOrder` a number. |
| `cues[].node` | node id | `type` is one of `audio, lighting, other`; `text` up to 2000. |
| `connections[].from` | node id | `to` is a node id, or `null` for an empty choice; `label` up to 200. |
| `media[]` | metadata only | The files are not in the file and import ignores the list; a file may leave it out (if no node names a cover). |
| `links[]` | optional list | A node's links: `node` a node id, `title` up to 120 (may be empty), `url` an `http://` or `https://` address up to 2000. Listed oldest first. The person who imports becomes their creator. Left out when there is none. |

`width`, `height`, `cover` and `links` were added to version 1 on 2026-11-26 as optional parts: files and snapshots made before then still read. A server from before that date refuses a file that has them (`unknown key`). A snapshot made earlier shows them after **Republish**.

## What the file carries

Every collection of a project, and every field of the imported ones, is listed as carried or excluded (with the reason) in [file-contract.ts](../../tests/rules/helpers/file-contract.ts). `tests/rules/project-file.fields.rules.test.ts` compares that list with the live database and checks that each carried field survives export and import, so **a new field or collection fails the test until you decide**. To carry a field: add it to `project-records.js`, `project-file-build.js`, `project-file-validate.js`, `project-file-plan.js`, `project-import.js`, the `ProjectFile` type (`share-types.ts`) and `contentFromFile` (`shareModel.ts`), list it in the contract, and give it a value in `tests/rules/helpers/carried.ts`.

Ids are the original ones. They are only keys: **import gives every record a new id** and maps every reference, so an id in a file can never collide with one in the database. The lists are sorted by position, sort order, then id; `connections` are the exception: they are listed in the order they were created (then id), which is the order of a node's choices in the editor, so a project read from a file (a share link's viewer, Player Mode) offers choices in the author's order. Import creates them in file order, so a re-import keeps it.

**Left out when exporting:** records with `deleted_at` set, the nodes of a trashed chapter (and their links), media with `removed_at` set, a cover that is not a live image of its node, and a link whose stored address is not a web address. A choice to a trashed node is kept with `to: null`.

## Limits

`FILE_LIMITS` in the library: 5,242,880 bytes (5 MB); 200 chapters, 2,000 nodes, 20,000 lines, 10,000 cues, 10,000 connections, 2,000 media entries, 10,000 links; text lengths as above (the collections' own maximums, read from the migrations). A text length counts characters, not bytes. An id is at most 100 characters.

## Problem messages

`validateProjectFile` never throws and stops after 20 problems. The import route shows the **first** as `This file is not a KWNTO project: <problem>`. `<path>` looks like `nodes[3].chapter`.

| Message | When |
|---|---|
| `it is not JSON` | The text is not JSON, or the JSON is not an object (`null`, a list, a number) |
| `format must be "kwnto-project"` | |
| `version must be 1` | |
| `<path> is missing` | A field, a list or `project` is absent (a list that is not a list counts as missing); a required text is empty |
| `<path> must be a string` | |
| `<path> must be a number` | Also `NaN` and infinities |
| `<path> must be between 0 and 2000` | A node's `width` or `height` |
| `<path> is not a web address` | `links[].url` |
| `<path> is not a media entry in the file` | `nodes[].cover` |
| `<path> must be one of <values>` | `color`, cue `type`, media `kind` |
| `<path> is longer than <n> characters` | |
| `too many <list> (<count>, at most <limit>)` | The elements of that list are then not checked one by one |
| `<path> is not a <chapter\|node> in the file` | A reference (`nodes[].chapter`, `lines[].node`, `cues[].node`, `connections[].from`, `connections[].to`, `project.startNode`, `media[].node`, `links[].node`) to an id the file does not hold |
| `duplicate id "<id>" in <list>` | |
| `unknown key "<key>" in <path>` | The path is `the file`, `project` or an element such as `nodes[0]`. The key is echoed cut to 50 characters. A `__proto__` key made by `JSON.parse` is refused like any other; only fixed keys are ever copied, into fresh objects |

If the file passes but the database still refuses a record (for example two connections between the same two nodes, which the pair index forbids), the whole import is rolled back and answers 400 `This file is not a KWNTO project: a record in it was refused`. Nothing is created.

## Choices to trashed nodes

A choice whose target is trashed is exported with `to: null`, like an empty choice, and keeps its text. A node may have several such choices: the unique pair index on `connections` covers only choices that have a target (`WHERE to_node != ''`, migration 1794370200), so they import. Pinned by `tests/rules/project-file.edge.rules.test.ts`.

## Live events and import

An import creates its records inside one transaction, and PocketBase sends no live create events for records made in a transaction. So a teammate who has the team's project list open does not see the imported project until the list is loaded again (a reload or opening the team). Known and accepted: the person who imported is taken to the project.

## Code layout

`lib/project-file.js` only joins four files: `project-file-limits.js` (`FILE_LIMITS` and the value lists), `project-file-build.js` (`buildProjectFile`), `project-file-validate.js` (`validateProjectFile`) and `project-file-plan.js` (`importPlan` and the route helpers). Each is under 300 lines.

## Routes

See [backend.md](backend.md), "Project files". Tests: `tests/hooks/project-file.unit.test.ts`, `tests/hooks/project-file.import.unit.test.ts`, `tests/rules/project-file.rules.test.ts`, `e2e/project-file.spec.ts`.
