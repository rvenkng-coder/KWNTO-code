// The project file (design 10, plan 7 D3 to D6): built, checked and turned into an import plan
// only on the server, so export, import, snapshots and the share view share one format and
// one validator. CommonJS so hooks can load it with require(`${__hooks}/lib/project-file.js`)
// and Vitest can load it too. The format is described in docs/developer/project-file.md.
// The code is split: limits, build, validate and plan; this file only joins them.

const { FILE_LIMITS } = require("./project-file-limits.js")
const { buildProjectFile } = require("./project-file-build.js")
const { validateProjectFile } = require("./project-file-validate.js")
const { importPlan, downloadName, importedName, utf8Length } = require("./project-file-plan.js")

module.exports = {
  FILE_LIMITS,
  buildProjectFile,
  validateProjectFile,
  importPlan,
  downloadName,
  importedName,
  utf8Length,
}
