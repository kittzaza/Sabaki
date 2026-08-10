import assert from 'assert'

import {
  coachProperty,
  decodeVerdict,
  encodeVerdict,
  readVerdicts,
} from '../src/modules/coachstorage.js'

const verdict = {
  v: 1,
  type: 'verdict',
  color: 'B',
  vertex: 'A1',
  moveNumber: 1,
  label: 'พลาดร้ายแรง',
  advice: 'ตานี้เปลี่ยนรูปเกมไปในทางเสียเปรียบมาก',
  loss: 13.1,
  lossUnit: 'score',
  severity: 4,
  considered: false,
  best: {
    vertex: 'Q16',
    visits: 400,
    winrate: 57.4,
    scoreLead: 0.5,
    pv: ['Q16'],
  },
  lines: ['[โค้ช] ดำเล่น A1 → พลาดร้ายแรง (เสีย 13.1 แต้มจากตาที่ดีที่สุด)'],
}

describe('encodeVerdict / decodeVerdict', () => {
  it('round-trips a verdict unchanged', () => {
    assert.deepStrictEqual(decodeVerdict(encodeVerdict(verdict)), verdict)
  })

  it('keeps Thai as readable text rather than escapes', () => {
    assert.ok(encodeVerdict(verdict).includes('พลาดร้ายแรง'))
  })

  // A game must always open, whatever state its coach data is in.
  it('rejects unusable values instead of throwing', () => {
    for (let bad of [
      '',
      'not json',
      '{',
      'null',
      '[]',
      '"text"',
      undefined,
      42,
    ]) {
      assert.strictEqual(decodeVerdict(bad), null, `should reject ${bad}`)
    }
  })

  it('rejects json that is not a verdict', () => {
    assert.strictEqual(decodeVerdict(JSON.stringify({type: 'position'})), null)
    assert.strictEqual(
      decodeVerdict(JSON.stringify({type: 'verdict', vertex: 'A1'})),
      null,
      'a verdict without lines cannot be displayed',
    )
  })
})

describe('readVerdicts', () => {
  // Minimal stand-in for the game tree: readVerdicts only needs listNodes().
  function treeOf(nodes) {
    return {
      *listNodes() {
        yield* nodes
      },
    }
  }

  it('collects verdicts from every node, keyed by node id', () => {
    let tree = treeOf([
      {id: 'root', data: {}},
      {id: 'n1', data: {B: ['aa'], [coachProperty]: [encodeVerdict(verdict)]}},
      {id: 'n2', data: {W: ['bb']}},
    ])

    let result = readVerdicts(tree)
    assert.deepStrictEqual(Object.keys(result), ['n1'])
    assert.strictEqual(result.n1.vertex, 'A1')
  })

  // Commentary belongs to the move it judges, not to the line being viewed, so
  // a variation reviewed earlier keeps its verdicts when you switch back to it.
  it('reads variations, not just the main line', () => {
    let tree = treeOf([
      {id: 'a', data: {[coachProperty]: [encodeVerdict(verdict)]}},
      {
        id: 'b',
        data: {[coachProperty]: [encodeVerdict({...verdict, vertex: 'T1'})]},
      },
    ])

    assert.deepStrictEqual(Object.keys(readVerdicts(tree)).sort(), ['a', 'b'])
  })

  it('skips corrupt entries without losing the good ones', () => {
    let tree = treeOf([
      {id: 'n1', data: {[coachProperty]: ['{{{ broken']}},
      {id: 'n2', data: {[coachProperty]: [encodeVerdict(verdict)]}},
      {id: 'n3', data: {[coachProperty]: []}},
    ])

    assert.deepStrictEqual(Object.keys(readVerdicts(tree)), ['n2'])
  })

  it('returns an empty map for a game with no review', () => {
    assert.deepStrictEqual(readVerdicts(treeOf([{id: 'root', data: {}}])), {})
  })
})
