import { useState } from 'react'
import { ExportDialog } from '../export/ExportDialog'
import { isMacPlatform, shortcutLabel } from '../model/shortcutLabel'
import { useEditor } from '../store/editorStore'
import { edits } from '../store/edits'
import { useCanvasCommands } from './canvasCommands'
import { cutSelection, trashSelection } from './selectionActions'
import { ToolButton } from './ToolButton'
import { useSelection } from './useSelection'

/** The tools in the toolbar above the canvas (editor cards design, goal 3): every tool names its shortcut in its tooltip. */
export function ToolStrip({ chapterId, projectName }: { chapterId: string | null; projectName: string }) {
  const [exporting, setExporting] = useState(false)
  const nodeIds = useSelection((s) => s.nodeIds)
  const hasClip = useEditor((s) => s.hasClip)
  const addNode = useCanvasCommands((s) => s.addNode)
  const areaSelect = useCanvasCommands((s) => s.areaSelect)
  const mac = isMacPlatform(navigator.platform)
  const none = nodeIds.length === 0
  return (
    <div data-testid="tool-strip" role="toolbar" aria-label="Tools" className="flex shrink-0 items-center gap-1">
      <ToolButton icon="add" name="Add node" hint="or double-click the canvas" disabled={addNode === null} onClick={() => addNode?.()} />
      <ToolButton icon="cut" name="Cut" hint={shortcutLabel('X', mac)} disabled={none} onClick={() => void cutSelection()} />
      <ToolButton icon="copy" name="Copy" hint={shortcutLabel('C', mac)} disabled={none} onClick={() => edits.copy(nodeIds)} />
      <ToolButton icon="paste" name="Paste" hint={shortcutLabel('V', mac)} disabled={!hasClip || chapterId === null}
        onClick={() => void (chapterId !== null && edits.paste(chapterId))} />
      <ToolButton icon="trash" name="Move to trash" hint="Delete" disabled={none} onClick={() => void trashSelection()} />
      <ToolButton icon="select" name="Area select" hint="or Shift+drag" pressed={areaSelect}
        onClick={() => useCanvasCommands.getState().toggleAreaSelect()} />
      <ToolButton icon="export" name="Export map" disabled={chapterId === null} onClick={() => setExporting(true)} />
      {exporting && <ExportDialog projectName={projectName} chapterId={chapterId} onClose={() => setExporting(false)} />}
    </div>
  )
}
