// True when the module is the script node was started with. Compares real paths, so a script run through
// a symlinked path (where argv[1] is the typed path and import.meta.filename the real one) still runs.
import { realpathSync } from 'node:fs'

export function isMain(metaFilename: string, argv1: string | undefined = process.argv[1]): boolean {
  if (!argv1) return false
  try {
    return realpathSync(argv1) === realpathSync(metaFilename)
  } catch {
    return false
  }
}
