// The limits of the project file (plan 7 D5) and its fixed value lists, in one place so the
// validator, the importer and the tests read the same numbers. CommonJS (see project-file.js).

// The text lengths and the colour and cue-type lists are the collections' own limits:
// project name from 1794370000_projects_chapters.js (projects.name 120, chapters.title 120);
// node title 200, node colour, line character 80, line text 5000, cue type and cue text
// 2000, connection label 200 from 1794370100_nodes_lines_connections.js; media title 120
// and kind from 1794380000_media.js. The counts and the 5 MB size are plan D5. `id`
// (an id in a file is only a key, so any short string will do) is this file's own limit.
const FILE_LIMITS = {
  maxBytes: 5242880,
  chapters: 200,
  nodes: 2000,
  lines: 20000,
  cues: 10000,
  connections: 10000,
  name: 120,
  title: 200,
  chapterTitle: 120,
  character: 80,
  text: 5000,
  label: 200,
  cueText: 2000,
  mediaTitle: 120,
  media: 2000,
  id: 100,
}
const COLORS = ['slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple']
const CUE_TYPES = ['audio', 'lighting', 'other']
const MEDIA_KINDS = ['audio', 'video', 'image']
const MAX_PROBLEMS = 20

module.exports = { FILE_LIMITS, COLORS, CUE_TYPES, MEDIA_KINDS, MAX_PROBLEMS }
