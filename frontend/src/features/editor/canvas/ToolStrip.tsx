import { useState } from 'react'
import { ExportDialog } from '../export/ExportDialog'
import { isMacPlatform, shortcutLabel } from '../model/shortcutLabel'
import { useEditor } from '../store/editorStore'
import { edits } from '../store/edits'
import { useCanvasCommands } from './canvasCommands'
import { cutSelection, trashSelection } from './selectionActions'
import { ToolButton } from './ToolButton'
import { useSelection } from './useSelection'
import { FONT_SIZES, type ViewPrefs } from './useViewPrefs'

/** The tools in the toolbar above the canvas (editor cards design, goal 3): every tool names its shortcut in its tooltip. */
interface Props { chapterId: string | null; projectName: string; view?: ViewPrefs }

export function ToolStrip({ chapterId, projectName, view }: Props) {
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
      <ToolButton icon="undo" name="Undo" onClick={() => void edits.undo()} />
      <ToolButton icon="redo" name="Redo" onClick={() => void edits.redo()} />
      <ToolButton icon="select" name="Area select" hint="or Shift+drag" pressed={areaSelect}
        onClick={() => useCanvasCommands.getState().toggleAreaSelect()} />
      <ToolButton icon="trash" name="Move to trash" hint="Delete" disabled={none} onClick={() => void trashSelection()} />
      <ToolButton icon="cut" name="Cut" hint={shortcutLabel('X', mac)} disabled={none} onClick={() => void cutSelection()} />
      <ToolButton icon="copy" name="Copy" hint={shortcutLabel('C', mac)} disabled={none} onClick={() => edits.copy(nodeIds)} />
      <ToolButton icon="paste" name="Paste" hint={shortcutLabel('V', mac)} disabled={!hasClip || chapterId === null}
        onClick={() => void (chapterId !== null && edits.paste(chapterId))} />
      <ToolButton icon="export" name="Export map" disabled={chapterId === null} onClick={() => setExporting(true)} />
      {view && (
        <select aria-label="Card font size" title="Card font size" className="field h-8 w-auto py-0" value={view.fontSize}
          onChange={(e) => view.setFontSize(Number(e.target.value))}>
          {FONT_SIZES.includes(view.fontSize) ? null : <option value={view.fontSize}>{view.fontSize}</option>}
          {FONT_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      )}
      {view && <ToolButton icon="map" name={view.minimap ? 'Hide minimap' : 'Show minimap'} pressed={view.minimap} onClick={view.toggleMinimap} />}
      {exporting && <ExportDialog projectName={projectName} chapterId={chapterId} onClose={() => setExporting(false)} />}
    </div>
  )
}
