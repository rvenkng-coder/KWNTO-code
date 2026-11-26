import { navigate } from '../shell/useRoute'
import { EditorPlay } from '../player/EditorPlay'
import { ExportButton } from '../projectFile/ExportButton'
import { MemberOnly } from '../share/MemberOnly'
import { ShareButton } from '../share/ShareButton'
import { InlineText } from './chapters/InlineText'
import { useEditor } from './store/editorStore'
import { edits } from './store/edits'

/** The project's controls in the title bar: Back to teams, the project name (far left), Back to teams, Export project file and Share. */
export function EditorHeader() {
  const project = useEditor((s) => s.content.project)
  if (project === null) return null
  return (
    <>
      <InlineText
        value={project.name}
        label="Project name"
        className="text-left text-lg font-semibold"
        onCommit={(name) => void edits.update('projects', project.id, { name }, 'Rename project')}
      />
      <button type="button" className="btn" onClick={() => navigate({ name: 'teams' })}>
        Back to teams
      </button>
      <EditorPlay />
      <MemberOnly teamId={project.teamId}>
        <ExportButton projectId={project.id} />
        <ShareButton projectId={project.id} projectName={project.name} />
      </MemberOnly>
    </>
  )
}
