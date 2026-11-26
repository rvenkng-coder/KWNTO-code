// What the share routes do (plan 7 Task 3). Needs a PocketBase app, so it is covered by the
// rules tests (tests/rules/share-routes.rules.test.ts), not by a unit test; the decisions
// themselves are in lib/share.js. Every token is a bound parameter, never part of a filter.

const BAD_LINK = "This link is not valid or was revoked."
const SIGN_IN = "Sign in to open this shared project."
const VERIFY = "Verify your email to open this shared project."

function isNoRows(error) {
  return String(error).includes("no rows")
}

// The link record for a token, or null. Anything but "no rows" is a real error.
function findLink(app, token) {
  try {
    return app.findFirstRecordByFilter("share_links", "token = {:t}", { t: token })
  } catch (error) {
    if (!isNoRows(error)) throw error
    return null
  }
}

function findOrNull(app, collection, id) {
  try {
    return app.findRecordById(collection, id)
  } catch (error) {
    if (!isNoRows(error)) throw error
    return null
  }
}

function callerOf(e) {
  const signedIn = e.auth !== null && e.auth !== undefined && e.auth.collection().name === "users"
  return { signedIn: signedIn, verified: signedIn && e.auth.verified() }
}

function refuse(status) {
  if (status === 401) return new ApiError(401, SIGN_IN, {})
  if (status === 403) return new ForbiddenError(VERIFY)
  return new NotFoundError(BAD_LINK)
}

// The link, its project and the decision for this caller. Throws the refusal (the same 404
// for a missing link, a revoked one and a trashed project).
function openLink(e, token) {
  const { shareAccess } = require(`${__hooks}/lib/share.js`)
  const link = findLink(e.app, token)
  const project = link === null ? null : findOrNull(e.app, "projects", link.getString("project"))
  const known = link !== null && project !== null
  const plain = known
    ? { revoked: link.getBool("revoked"), permission: link.getString("permission"), kind: link.getString("kind") }
    : null
  const decision = shareAccess(plain, known && project.getString("deleted_at") !== "", callerOf(e))
  if (decision.status !== 200) throw refuse(decision.status)
  return { link: link, project: project, mode: decision.mode }
}

function storedSnapshot(link) {
  const raw = link.getString("snapshot_data")
  return raw === "" ? null : JSON.parse(raw)
}

function nowText() {
  return new Date().toISOString().replace("T", " ")
}

function buildFile(app, projectId) {
  const { buildProjectFile } = require(`${__hooks}/lib/project-file.js`)
  const { loadProjectRecords } = require(`${__hooks}/lib/project-records.js`)
  return buildProjectFile(loadProjectRecords(app, projectId), nowText())
}

function sendJson(e, body) {
  e.response.header().set("Content-Type", "application/json; charset=UTF-8")
  return e.string(200, JSON.stringify(body))
}

// GET /api/kwnto/share/{token}
function handleOpen(e) {
  const { link, project, mode } = openLink(e, e.request.pathValue("token"))
  if (mode === "edit") {
    return sendJson(e, { permission: "edit", projectId: project.id })
  }
  const snapshot = link.getString("kind") === "snapshot"
  return sendJson(e, {
    permission: mode,
    kind: link.getString("kind"),
    projectId: project.id,
    projectName: project.getString("name"),
    file: snapshot ? storedSnapshot(link) : buildFile(e.app, project.id),
  })
}

function isMember(app, project, userId) {
  const rows = app.findRecordsByFilter("team_members", "team = {:team} && user = {:user}", "", 1, 0, {
    team: project.getString("team"),
    user: userId,
  })
  return rows.length > 0
}

function findGrant(app, link, userId) {
  try {
    return app.findFirstRecordByFilter("link_grants", "link = {:l} && user = {:u}", { l: link.id, u: userId })
  } catch (error) {
    if (!isNoRows(error)) throw error
    return null
  }
}

function makeGrant(app, link, project, userId) {
  const grant = new Record(app.findCollectionByNameOrId("link_grants"))
  grant.set("link", link.id)
  grant.set("user", userId)
  grant.set("project", project.id)
  grant.set("permission", link.getString("permission"))
  grant.set("project_name", project.getString("name"))
  app.save(grant)
}

// POST /api/kwnto/share/{token}/join: a verified person opens a comment or edit link and
// gets one grant for it; a team member needs none; a view link cannot be joined.
function handleJoin(e) {
  const { link, project, mode } = openLink(e, e.request.pathValue("token"))
  if (mode === "view") throw new NotFoundError(BAD_LINK)
  if (!isMember(e.app, project, e.auth.id) && findGrant(e.app, link, e.auth.id) === null) {
    try {
      makeGrant(e.app, link, project, e.auth.id)
    } catch (error) {
      // Two joins at once: the unique index let one through; the grant exists now.
      if (findGrant(e.app, link, e.auth.id) === null) throw error
    }
  }
  return e.json(200, { projectId: project.id, permission: mode })
}

// Where a stored file lives and the thumb size a request may ask for.
function serveFile(e, media) {
  const { applyDownloadHeaders } = require(`${__hooks}/lib/media-hook.js`)
  const name = media.getString("file")
  const base = `${media.baseFilesPath()}/`
  const fsys = e.app.newFilesystem()
  try {
    let key = base + name
    if (e.request.url.query().get("thumb") === "100x100") {
      const thumbKey = `${base}thumbs_${name}/100x100_${name}`
      if (!fsys.exists(thumbKey)) {
        try {
          fsys.createThumb(key, thumbKey, "100x100")
        } catch (error) {
          // Not an image or not decodable: the original is served instead.
        }
      }
      if (fsys.exists(thumbKey)) key = thumbKey
    }
    applyDownloadHeaders(e.response, name)
    fsys.serve(e.response, e.request, key, name)
  } finally {
    fsys.close()
  }
}

// True when the media's node, or that node's chapter, is in the trash.
function mediaIsTrashed(app, media) {
  const node = findOrNull(app, "nodes", media.getString("node"))
  if (node === null || node.getString("deleted_at") !== "") return true
  const chapter = findOrNull(app, "chapters", node.getString("chapter"))
  return chapter === null || chapter.getString("deleted_at") !== ""
}

// GET /api/kwnto/share/{token}/media/{mediaId}
function handleMedia(e) {
  const { snapshotMediaIds } = require(`${__hooks}/lib/share.js`)
  const { link, project, mode } = openLink(e, e.request.pathValue("token"))
  const media = mode === "edit" ? null : findOrNull(e.app, "media", e.request.pathValue("mediaId"))
  const usable = media !== null && media.getString("project") === project.id && media.getString("removed_at") === ""
  const live = link.getString("kind") !== "snapshot"
  const listed = live || snapshotMediaIds(storedSnapshot(link)).includes(media === null ? "" : media.id)
  // A live link shows what the project shows: the media of a node or chapter in the trash is hidden
  // with it, as the file the viewer reads leaves it out. A snapshot keeps what it listed.
  if (!usable || !listed || (live && mediaIsTrashed(e.app, media))) throw new NotFoundError(BAD_LINK)
  serveFile(e, media)
}

// POST /api/kwnto/share-links/{id}/republish
function handleRepublish(e) {
  const link = findOrNull(e.app, "share_links", e.request.pathValue("id"))
  const project = link === null ? null : findOrNull(e.app, "projects", link.getString("project"))
  if (project === null || !isMember(e.app, project, e.auth.id) || link.getBool("revoked")) {
    throw new NotFoundError("No link with this id.")
  }
  if (link.getString("kind") !== "snapshot") {
    throw new BadRequestError("Only a snapshot can be republished.")
  }
  link.set("snapshot_data", buildFile(e.app, project.id))
  e.app.save(link)
  return e.json(200, {
    id: link.id,
    project: project.id,
    permission: link.getString("permission"),
    kind: link.getString("kind"),
    token: link.getString("token"),
    revoked: false,
  })
}

// POST /api/kwnto/admin/share-links/revoke-all (runbook control 6)
function handleRevokeAll(e) {
  const { logEvent } = require(`${__hooks}/lib/security-log.js`)
  let count = 0
  e.app.runInTransaction((tx) => {
    for (const link of tx.findAllRecords("share_links", $dbx.hashExp({ revoked: false }))) {
      link.set("revoked", true)
      tx.save(link)
      count++
    }
  })
  logEvent(e.app, "admin", "", e.realIP(), { action: "revoke-all-links", count: count })
  return e.json(200, { count: count })
}

module.exports = { handleOpen, handleJoin, handleMedia, handleRepublish, handleRevokeAll }
