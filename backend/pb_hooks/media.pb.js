/// <reference path="../pb_data/types.d.ts" />
// Media uploads: type detection, size limits, quota and safe naming (design 6.2, 7c).

onRecordCreate((e) => {
  const { handleMediaCreate } = require(`${__hooks}/lib/media-hook.js`)
  handleMediaCreate(e)
}, "media")

onRecordUpdateRequest((e) => {
  const { handleMediaUpdate } = require(`${__hooks}/lib/media-hook.js`)
  handleMediaUpdate(e)
}, "media")

onFileDownloadRequest((e) => {
  const { handleFileDownload } = require(`${__hooks}/lib/media-hook.js`)
  handleFileDownload(e)
}, "media")

routerAdd("GET", "/api/kwnto/storage", (e) => {
  const { handleStorageRoute } = require(`${__hooks}/lib/media-hook.js`)
  return handleStorageRoute(e)
}, $apis.requireAuth("users"))
