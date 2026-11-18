// Media hook implementation helpers for PocketBase JS hooks.

function getUploaderUsedBytes(app, userId) {
  const row = new DynamicModel({ total: 0 })
  app.db()
    .newQuery("SELECT COALESCE(SUM(size_bytes), 0) AS total FROM media WHERE uploader = {:user}")
    .bind({ user: userId })
    .one(row)
  return Number(row.total) || 0
}

function getUploaderQuota(app, userId, defaultQuotaBytes, quotaFor) {
  try {
    const limitRow = app.findFirstRecordByFilter("user_limits", "user = {:user}", { user: userId })
    const override = limitRow.getInt("quota_override_bytes")
    return quotaFor(defaultQuotaBytes, override)
  } catch {
    return defaultQuotaBytes
  }
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
  const uploaderId = e.record.getString("uploader")
  const settings = deps.getSystemStorage(e.app)
  const quotaBytes = getUploaderQuota(e.app, uploaderId, settings.defaultQuotaBytes, deps.quotaFor)
  const usedBytes = getUploaderUsedBytes(e.app, uploaderId)

  const reader = file.reader.open()
  const head = toBytes(reader, 16)
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

  return { file, originalName, head, settings, quotaBytes, uploaderId }
}

function verifyRaceQuota(e, deps, prep) {
  let quotaExceeded = false
  let usedBefore = 0
  e.app.runInTransaction((txApp) => {
    const records = txApp.findRecordsByFilter("media", "uploader = {:user}", "", 0, 0, { user: prep.uploaderId })
    const rows = records.map((r) => ({
      id: r.id,
      created: r.getString("created"),
      size: r.getInt("size_bytes"),
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

  const userId = e.auth.id
  const settings = getSystemStorage(e.app)
  const quotaBytes = getUploaderQuota(e.app, userId, settings.defaultQuotaBytes, quotaFor)
  const usedBytes = getUploaderUsedBytes(e.app, userId)

  const MIB = 1048576
  return e.json(200, {
    usedBytes,
    quotaBytes,
    maxBytes: {
      audio: settings.maxMb.audio * MIB,
      video: settings.maxMb.video * MIB,
      image: settings.maxMb.image * MIB,
    },
    allowedTypes: settings.allowedTypes,
  })
}

module.exports = {
  handleMediaCreate,
  handleFileDownload,
  handleStorageRoute,
}
