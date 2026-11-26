import { adminPB } from './admin'

// Seeds a large project straight into the test backend for the canvas performance test
// (editor core plan, Task 10, checkpoint 10D). Records go in through the admin API in
// parallel chunks of 50; the hooks still make the project's settings and `Chapter 1`, and
// make the first node the start node.

const CHUNK = 50
const COLUMNS = 25

async function inChunks<T>(items: T[], create: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) {
    await Promise.all(items.slice(i, i + CHUNK).map(create))
  }
}

/**
 * A project in the team with one chapter holding `nodes` nodes on a 25-column grid, each with
 * `linesPerNode` script lines, chained by `nodes - 1` connections (node i to node i + 1).
 */
export async function seedLargeProject(
  teamId: string,
  nodes: number,
  linesPerNode: number,
): Promise<{ projectId: string; chapterId: string }> {
  const pb = await adminPB()
  // requestKey null: the SDK would otherwise cancel all but the last of many parallel creates.
  const opts = { requestKey: null }
  const project = await pb.collection('projects').create({ team: teamId, name: `Large ${nodes}` }, opts)
  const chapter = await pb.collection('chapters').getFirstListItem(pb.filter('project = {:p}', { p: project.id }), opts)
  const indexes = Array.from({ length: nodes }, (_, i) => i)
  const ids: string[] = []
  const createNode = async (i: number) => {
    const record = await pb.collection('nodes').create(
      {
        project: project.id,
        chapter: chapter.id,
        title: `Node ${i + 1}`,
        color: 'blue',
        x: (i % COLUMNS) * 300,
        y: Math.floor(i / COLUMNS) * 220,
      },
      opts,
    )
    ids[i] = record.id
  }
  // The first node goes in alone so the hook makes it the start node.
  await createNode(0)
  await inChunks(indexes.slice(1), createNode)
  const lines = indexes.flatMap((i) => Array.from({ length: linesPerNode }, (_, j) => ({ node: ids[i], order: j + 1 })))
  await inChunks(lines, (l) =>
    pb.collection('script_lines').create(
      {
        project: project.id,
        node: l.node,
        character: 'Narrator',
        text: `Line ${l.order} of a long scene.`,
        sort_order: l.order,
      },
      opts,
    ),
  )
  await inChunks(indexes.slice(1), (i) =>
    pb.collection('connections').create(
      {
        project: project.id,
        from_node: ids[i - 1],
        to_node: ids[i],
        label: '',
      },
      opts,
    ),
  )
  return { projectId: project.id, chapterId: chapter.id }
}
