import { createLine, createNode, memberProject, type MemberProject } from './content.ts'
import { asUser } from './pb.ts'

// A project holding a value in every field the project file carries (see file-contract.ts). A new
// carried field needs a value here.
export async function createCarriedProject(): Promise<MemberProject> {
  const ctx = await memberProject()
  const pb = await asUser(ctx.member)
  const chapter = (await pb.collection('chapters').create({ project: ctx.projectId, title: 'Second', position: 2 })).id
  const look = { color: 'red', x: 40, y: 80, width: 320, height: 240 }
  const first = await createNode(ctx.member, ctx.projectId, ctx.chapterId, { title: 'Opening', ...look })
  const second = await createNode(ctx.member, ctx.projectId, chapter, { title: 'Later', color: 'blue', x: 5, y: 6 })
  await createLine(ctx.member, ctx.projectId, first, { character: 'Mara', text: 'Hello there.', sort_order: 1.5 })
  await pb
    .collection('cues')
    .create({ project: ctx.projectId, node: first, type: 'audio', text: 'rain', sort_order: 2 })
  await pb
    .collection('connections')
    .create({ project: ctx.projectId, from_node: first, to_node: second, label: 'Go on' })
  await pb.collection('node_links').create({
    project: ctx.projectId,
    node: first,
    creator: ctx.member.id,
    title: 'Trailer',
    url: 'https://example.com/v',
  })
  return ctx
}
