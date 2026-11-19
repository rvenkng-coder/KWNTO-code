import type { StorageInfo } from '../../../backend/media-types.ts'
import { meterText } from './mediaList.ts'

export function StorageMeter({ info }: { info: StorageInfo | null }) {
  if (!info) return null
  return (
    <div data-testid="storage-meter" className="text-xs text-muted">
      {meterText(info)}
    </div>
  )
}
