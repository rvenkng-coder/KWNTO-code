import type { Chapter } from '../../../backend'
import { navigate } from '../../shell/useRoute'
import { InlineText } from './InlineText'
import { addChapter, renameChapter, trashChapter } from './chapterActions'
import { useTabsView } from './useTabsView'

interface ChapterListProps { projectId: string; chapters: Chapter[]; activeId: string | null }

/** Every live chapter of the project, including those whose tab is closed (a click reopens the tab). */
export function ChapterList({ projectId, chapters, activeId }: ChapterListProps) {
  const open = useTabsView((s) => s.open)
  const show = (id: string) => {
    open(id)
    navigate({ name: 'project', projectId, chapterId: id })
  }
  return (
    <div data-testid="chapter-list" className="flex flex-col gap-2">
      <h3>Chapters</h3>
      <ul className="flex flex-col gap-1">
        {chapters.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <InlineText
              value={c.title}
              label="Chapter title"
              className={c.id === activeId ? 'font-semibold' : ''}
              onClick={() => show(c.id)}
              onCommit={(title) => void renameChapter(c.id, title)}
            />
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                if (confirm(`Move "${c.title}" to the trash?`)) void trashChapter(c.id)
              }}
            >
              Move to trash
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn self-start"
        onClick={() => void addChapter(projectId, chapters).then((id) => show(id))}
      >
        Add chapter
      </button>
    </div>
  )
}
