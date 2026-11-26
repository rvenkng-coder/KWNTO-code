import { describe, expect, it } from 'vitest'
import { createFollowGate } from './followGate'

function gateAt(start: string) {
  const at = { route: start }
  return { at, gate: createFollowGate(() => at.route) }
}

describe('createFollowGate', () => {
  // Protects: pressing + and waiting still opens the new chapter.
  it('is wanted when nothing else happened', () => {
    const { gate } = gateAt('#/a')
    expect(gate.claim()()).toBe(true)
  })

  // Protects: issue 37: clicking the tab already open changes no route, and still must keep the person there.
  it('is not wanted after the person chose a place, even the same one', () => {
    const { gate } = gateAt('#/a')
    const wanted = gate.claim()
    gate.moved()
    expect(wanted()).toBe(false)
  })

  // Protects: a route changed from elsewhere (search jump, back button, another project) is not overridden.
  it('is not wanted after the route changed', () => {
    const { at, gate } = gateAt('#/a')
    const wanted = gate.claim()
    at.route = '#/b'
    expect(wanted()).toBe(false)
  })

  // Protects: + pressed twice opens the second new chapter, whichever save ends first.
  it('only the newest claim is wanted', () => {
    const { gate } = gateAt('#/a')
    const first = gate.claim()
    const second = gate.claim()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })

  // Protects: a choice made before + was pressed does not stop the new chapter from opening.
  it('is wanted when the choice came before the claim', () => {
    const { gate } = gateAt('#/a')
    gate.moved()
    expect(gate.claim()()).toBe(true)
  })
})
