// Who may open a project through a share link (design 5, plan 7 D2 and D8). CommonJS so
// hooks can load it with require(`${__hooks}/lib/share.js`) and Vitest can load it too.

const NOT_FOUND = { status: 404, mode: null }

// link: { revoked, permission, kind } or null; projectTrashed: boolean;
// caller: { signedIn, verified }. A missing or revoked link and a trashed project are the
// same 404 for everyone (no oracle). View links open for anyone; comment and edit links
// need a signed-in (401) and verified (403) caller.
function shareAccess(link, projectTrashed, caller) {
  if (link === null || link.revoked || projectTrashed) return NOT_FOUND
  if (link.permission !== "view" && !caller.signedIn) return { status: 401, mode: null }
  if (link.permission !== "view" && !caller.verified) return { status: 403, mode: null }
  return { status: 200, mode: link.permission }
}

// The media ids a snapshot lists. Anything that is not a list of entries with a string id
// gives no ids: a snapshot is stored data, and a bad one must not open any media.
function snapshotMediaIds(snapshotData) {
  if (snapshotData === null || typeof snapshotData !== "object" || !Array.isArray(snapshotData.media)) return []
  return snapshotData.media
    .filter((entry) => entry !== null && typeof entry === "object" && typeof entry.id === "string")
    .map((entry) => entry.id)
}

module.exports = { shareAccess, snapshotMediaIds }
