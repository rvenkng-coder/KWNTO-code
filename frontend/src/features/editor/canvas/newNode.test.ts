import { describe, expect, test } from 'vitest'
import { freeSpot, newNodeRecord } from './newNode'

describe('freeSpot', () => {
  // Protects: the spot is a whole-number point, as every saved node position is.
  test('freeSpot rounds the point when nothing is there', () => {
    expect(freeSpot({ x: 10.6, y: 20.4 }, [])).toEqual({ x: 11, y: 20 })
  })

  // Protects: a second node never lands exactly on a first, so it cannot hide under it (Review Focus 4).
  test('freeSpot steps 40 px right and down past taken spots', () => {
    expect(
      freeSpot({ x: 100, y: 100 }, [
        { x: 100, y: 100 },
        { x: 140, y: 140 },
      ]),
    ).toEqual({ x: 180, y: 180 })
  })

  // Protects: only a node exactly on the spot moves the new one; a neighbour 1 px away does not.
  test('freeSpot ignores nodes near the spot but not on it', () => {
    expect(freeSpot({ x: 100, y: 100 }, [{ x: 101, y: 100 }])).toEqual({ x: 100, y: 100 })
  })
})

describe('newNodeRecord', () => {
  // Protects: a node made from the button or a double-click is a live, titled, default-colour node at a whole-number point.
  test('newNodeRecord makes a titled node at the point', () => {
    const node = newNodeRecord('p', 'c', { x: 10.4, y: -3.6 })
    expect(node).toMatchObject({
      projectId: 'p',
      chapterId: 'c',
      title: 'New node',
      color: 'blue',
      x: 10,
      y: -4,
      deleted: false,
      version: 0,
    })
    expect(node.id).toMatch(/^[a-z0-9]{15}$/)
  })
})
