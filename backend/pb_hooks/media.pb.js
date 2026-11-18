/// <reference path="../pb_data/types.d.ts" />
// Media uploads: type detection, size limits, quota and safe naming (design 6.2, 7c).

onRecordCreate((e) => {
  const { checkUpload, quotaFor, usedThrough } = require(`${__hooks}/lib/media-check.js`)
  const { getSystemStorage } = require(`${__hooks}/lib/settings.js`)

  function getUploaderUsedBytes(app, userId) {
    const row = new DynamicModel({ total: 0 })
    app.db()
      .newQuery("SELECT COALESCE(SUM(size_bytes), 0) AS total FROM media WHERE uploader = {:user}")
      .bind({ user: userId })
      .one(row)
    return Number(row.total) || 0
  }

  function getUploaderQuota(app, userId, defaultQuotaBytes) {
    try {
      const limitRow = app.findFirstRecordByFilter("user_limits", "user = {:user}", { user: userId })
      const override = limitRow.getInt("quota_override_bytes")
      return quotaFor(defaultQuotaBytes, override)
    } catch {
      return defaultQuotaBytes
    }
  }

  function resolveExtension(type) {
    return type === "jpeg" ? "jpg" : type
  }

  function checkAndThrow(input) {
    const check = checkUpload(input)
    if (!check.ok) {
      throw new BadRequestError(check.message, {
        file: new ValidationError(check.code, check.message),
      })
    }
    return check
  }

  const file = e.record.get("file")
  if (!file || typeof file !== "object") {
    throw new BadRequestError("File is required")
  }
  const uploaderId = e.record.getString("uploader")
  const settings = getSystemStorage(e.app)
  const quotaBytes = getUploaderQuota(e.app, uploaderId, settings.defaultQuotaBytes)
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
  })

  e.record.set("kind", check.kind)
  e.record.set("size_bytes", file.size)
  e.record.set("title", originalName.slice(0, 120))

  const ext = resolveExtension(check.type)
  const randomName = $security.randomStringWithAlphabet(15, "abcdefghijklmnopqrstuvwxyz0123456789")
  file.name = `${randomName}.${ext}`

  // Insert stays outside our transaction so teammates get the live create event
  e.next()

  // Parallel upload race check
  let quotaExceeded = false
  let usedBefore = 0
  e.app.runInTransaction((txApp) => {
    const records = txApp.findRecordsByFilter("media", "uploader = {:user}", "", 0, 0, { user: uploaderId })
    const rows = records.map((r) => ({
      id: r.id,
      created: r.getString("created"),
      size: r.getInt("size_bytes"),
    }))
    const totalThrough = usedThrough(rows, e.record.id)
    if (totalThrough > quotaBytes) {
      txApp.delete(e.record)
      usedBefore = totalThrough - file.size
      quotaExceeded = true
    }
  })

  if (quotaExceeded) {
    checkAndThrow({
      fileName: originalName,
      size: file.size,
      head,
      allowedTypes: settings.allowedTypes,
      maxMb: settings.maxMb,
      usedBytes: usedBefore,
      quotaBytes,
    })
  }
}, "media")
