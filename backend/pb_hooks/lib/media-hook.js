// Media hook implementation helpers for PocketBase JS hooks.

// Storage belongs to the team owner (the lead): every file in the team's projects counts
// against the owner's quota, whoever uploaded it and whether or not it is removed.
function getTeamOwnerId(app, projectId) {
  const project = app.findRecordById("projects", projectId)
  return app.findRecordById("teams", project.getString("team")).getString("owner")
}

function getOwnerUsedBytes(app, ownerId) {
  const row = new DynamicModel({ total: 0 })
  app.db()
    .newQuery(
      "SELECT COALESCE(SUM(m.size_bytes), 0) AS total FROM media m " +
      "JOIN projects p ON p.id = m.project JOIN teams t ON t.id = p.team WHERE t.owner = {:owner}"
    )
    .bind({ owner: ownerId })
    .one(row)
  return Number(row.total) || 0
}

function getOwnerQuota(app, userId, defaultQuotaBytes, quotaFor) {
  let limitRow
  try {
    limitRow = app.findFirstRecordByFilter("user_limits", "user = {:user}", { user: userId })
  } catch (err) {
    // No override row means the default quota; any other failure must not silently change the quota.
    if (String(err).includes("no rows")) return defaultQuotaBytes
    throw err
  }
  return quotaFor(defaultQuotaBytes, limitRow.getInt("quota_override_bytes"))
}

function checkAndThrow(input, checkUpload) {
  const check = checkUpload(input)
  if (!check.ok) {
    throw new BadRequestError(check.message, {
      file: new ValidationError(check.code, check.message),
    })
  }
  return check
}

function resolveExtension(type) {
  return type === "jpeg" ? "jpg" : type
}

function prepareUploadRecord(e, deps) {
  const file = e.record.get("file")
  if (!file || typeof file !== "object") {
    throw new BadRequestError("File is required")
  }
  const ownerId = getTeamOwnerId(e.app, e.record.getString("project"))
  const settings = deps.getSystemStorage(e.app)
  const quotaBytes = getOwnerQuota(e.app, ownerId, settings.defaultQuotaBytes, deps.quotaFor)
  const usedBytes = getOwnerUsedBytes(e.app, ownerId)

  const reader = file.reader.open()
  let head
  try {
    head = toBytes(reader, 16)
  } finally {
    reader.close()
  }
  const originalName = file.originalName || file.name

  const check = checkAndThrow({
    fileName: originalName,
    size: file.size,
    head,
    allowedTypes: settings.allowedTypes,
    maxMb: settings.maxMb,
    usedBytes,
    quotaBytes,
  }, deps.checkUpload)

  e.record.set("kind", check.kind)
  e.record.set("size_bytes", file.size)
  e.record.set("title", originalName.slice(0, 120))

  const ext = resolveExtension(check.type)
  const randomName = $security.randomStringWithAlphabet(15, "abcdefghijklmnopqrstuvwxyz0123456789")
  file.name = `${randomName}.${ext}`

  return { file, originalName, head, settings, quotaBytes, ownerId }
}

function verifyRaceQuota(e, deps, prep) {
  let quotaExceeded = false
  let usedBefore = 0
  e.app.runInTransaction((txApp) => {
    // Order by insertion (rowid), not by `created`: a record gets its `created` before it waits for
    // the database write lock, so two parallel uploads can be inserted in the opposite order to their
    // timestamps and then each see the other as "later" and both stay. Insertion order is the same for
    // every observer, so the later insert is always the one over quota. `created` below is the
    // position in that order, which is what `usedThrough` sorts by.
    const found = arrayOf(new DynamicModel({ id: "", size_bytes: 0 }))
    txApp.db()
      .newQuery(
        "SELECT m.id AS id, COALESCE(m.size_bytes, 0) AS size_bytes FROM media m " +
        "JOIN projects p ON p.id = m.project JOIN teams t ON t.id = p.team " +
        "WHERE t.owner = {:owner} ORDER BY m.rowid"
      )
      .bind({ owner: prep.ownerId })
      .all(found)
    const rows = found.map((r, position) => ({
      id: r.id,
      created: String(position).padStart(12, "0"),
      size: Number(r.size_bytes) || 0,
    }))
    const totalThrough = deps.usedThrough(rows, e.record.id)
    if (totalThrough > prep.quotaBytes) {
      txApp.delete(e.record)
      usedBefore = totalThrough - prep.file.size
      quotaExceeded = true
    }
  })

  if (quotaExceeded) {
    checkAndThrow({
      fileName: prep.originalName,
      size: prep.file.size,
      head: prep.head,
      allowedTypes: prep.settings.allowedTypes,
      maxMb: prep.settings.maxMb,
      usedBytes: usedBefore,
      quotaBytes: prep.quotaBytes,
    }, deps.checkUpload)
    // The record is already deleted: never report this create as a success.
    throw new BadRequestError("Not enough storage.", {
      file: new ValidationError("media_over_quota", "Not enough storage."),
    })
  }
}

function handleMediaCreate(e) {
  const { checkUpload, quotaFor, usedThrough } = require(`${__hooks}/lib/media-check.js`)
  const { getSystemStorage } = require(`${__hooks}/lib/settings.js`)
  const deps = { checkUpload, quotaFor, usedThrough, getSystemStorage }

  const prep = prepareUploadRecord(e, deps)
  e.next()
  verifyRaceQuota(e, deps, prep)
}

function handleFileDownload(e) {
  const name = e.servedName || e.servedPath || ""
  const dot = name.lastIndexOf(".")
  const ext = dot !== -1 ? name.slice(dot + 1).toLowerCase() : ""
  const contentTypes = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    mov: "video/quicktime",
    mp4: "video/mp4",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  }
  const contentType = contentTypes[ext]
  if (contentType) {
    e.requestEvent.response.header().set("Content-Type", contentType)
  }
  e.requestEvent.response.header().set("X-Content-Type-Options", "nosniff")
  e.requestEvent.response.header().set(
    "Content-Security-Policy",
    "default-src 'none'; img-src 'self'; media-src 'self'; sandbox"
  )
  e.next()
}

function handleStorageRoute(e) {
  const { quotaFor } = require(`${__hooks}/lib/media-check.js`)
  const { getSystemStorage } = require(`${__hooks}/lib/settings.js`)

  if (!e.auth.verified()) {
    throw new ForbiddenError("Verify your email address first.")
  }

  // The meter is the team lead's storage for one project, so the caller must be on its team.
  const projectId = e.request.url.query().get("project")
  if (!projectId) {
    throw new BadRequestError("project is required")
  }
  let ownerId
  try {
    const teamId = e.app.findRecordById("projects", projectId).getString("team")
    e.app.findFirstRecordByFilter("team_members", "team = {:team} && user = {:user}", { team: teamId, user: e.auth.id })
    ownerId = e.app.findRecordById("teams", teamId).getString("owner")
  } catch (err) {
    if (String(err).includes("no rows")) throw new NotFoundError("Project not found.")
    throw err
  }

  const settings = getSystemStorage(e.app)
  const quotaBytes = getOwnerQuota(e.app, ownerId, settings.defaultQuotaBytes, quotaFor)
  const usedBytes = getOwnerUsedBytes(e.app, ownerId)

  const MIB = 1048576
  return e.json(200, {
    usedBytes,
    quotaBytes,
    isLead: ownerId === e.auth.id,
    maxBytes: {
      audio: settings.maxMb.audio * MIB,
      video: settings.maxMb.video * MIB,
      image: settings.maxMb.image * MIB,
    },
    allowedTypes: settings.allowedTypes,
  })
}

// Media is never edited: the only change allowed is hiding it (`removed_at` set) by any member,
// and bringing it back (cleared) by the team owner. The update rule has already checked membership.
function handleMediaUpdate(e) {
  const { changedFields } = require(`${__hooks}/lib/content-guard.js`)
  const names = []
  for (const field of e.record.collection().fields) names.push(field.getName())
  const original = e.record.original()
  const changed = changedFields(names, (n) => e.record.get(n), (n) => original.get(n))

  if (changed.some((name) => name !== "removed_at")) {
    throw new BadRequestError("Media can only be removed or restored.")
  }
  const restoring = changed.includes("removed_at") && e.record.getString("removed_at") === ""
  // The admin (a superuser, who skips the rules) may restore too.
  if (restoring && !e.hasSuperuserAuth() && getTeamOwnerId(e.app, e.record.getString("project")) !== e.auth.id) {
    throw new ForbiddenError("Only the team lead can restore media.")
  }
  e.next()
}

module.exports = {
  handleMediaCreate,
  handleFileDownload,
  handleMediaUpdate,
  handleStorageRoute,
}
