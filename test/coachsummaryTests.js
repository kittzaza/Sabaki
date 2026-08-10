import assert from 'assert'

import {
  blackLeadBefore,
  collectVerdicts,
  findTurningPoints,
  listReviewableNodes,
  summarizeVerdicts,
} from '../src/modules/coachsummary.js'

// Shape of the verdict events the Thai Go Coach proxy emits, trimmed to the
// fields the report reads.
function verdict(moveNumber, color, vertex, severity, loss, scoreLead = null) {
  return {
    nodeId: `n${moveNumber}`,
    event: {
      type: 'verdict',
      moveNumber,
      color,
      vertex,
      severity,
      loss,
      label: ['ยอดเยี่ยม', 'ดี', 'พอใช้', 'พลาด', 'พลาดร้ายแรง'][severity],
      best: scoreLead == null ? null : {vertex: 'Q16', scoreLead},
    },
  }
}

// A verdict the coach could not put a number on — the engine never searched the
// move and the follow-up analysis was too shallow to measure the swing.
function unmeasured(moveNumber, color, vertex) {
  return {
    nodeId: `n${moveNumber}`,
    event: {
      type: 'verdict',
      moveNumber,
      color,
      vertex,
      severity: null,
      loss: null,
      label: 'นอกสายตา engine',
      best: null,
    },
  }
}

describe('summarizeVerdicts', () => {
  it('counts each player’s moves by severity', () => {
    let report = summarizeVerdicts([
      verdict(1, 'B', 'D4', 0, 0.1),
      verdict(2, 'W', 'Q16', 3, 4.0),
      verdict(3, 'B', 'C3', 4, 9.5),
      verdict(4, 'W', 'R5', 0, 0.2),
    ])

    assert.deepStrictEqual(report.players.B.counts, [1, 0, 0, 0, 1])
    assert.deepStrictEqual(report.players.W.counts, [1, 0, 0, 1, 0])
    assert.strictEqual(report.players.B.moves, 2)
    assert.strictEqual(report.players.W.moves, 2)
    assert.strictEqual(report.moves, 4)
  })

  it('totals and averages the points each player gave away', () => {
    let report = summarizeVerdicts([
      verdict(1, 'B', 'D4', 2, 2.0),
      verdict(3, 'B', 'C3', 4, 8.0),
      verdict(2, 'W', 'Q16', 1, 1.0),
    ])

    assert.strictEqual(report.players.B.totalLoss, 10)
    assert.strictEqual(report.players.B.averageLoss, 5)
    assert.strictEqual(report.players.W.totalLoss, 1)
  })

  it('ranks the worst moves by points lost, biggest first', () => {
    let report = summarizeVerdicts([
      verdict(1, 'B', 'D4', 2, 2.0),
      verdict(3, 'B', 'C3', 4, 9.0),
      verdict(5, 'B', 'T1', 3, 5.0),
      verdict(7, 'B', 'A1', 1, 1.0),
    ])

    assert.deepStrictEqual(
      report.players.B.worst.map((x) => x.vertex),
      ['C3', 'T1', 'D4'],
    )
    assert.strictEqual(report.players.B.worst[0].loss, 9)
    assert.strictEqual(report.players.B.worst[0].nodeId, 'n3')
  })

  // "Costliest moves" naming a move the coach called flawless reads as
  // criticism of a move that cost nothing.
  it('leaves flawless moves out of the costliest list', () => {
    let report = summarizeVerdicts([
      verdict(1, 'B', 'D4', 0, 0.0),
      verdict(3, 'B', 'C3', 0, 0.2),
      verdict(5, 'B', 'T1', 1, 1.1),
    ])

    assert.deepStrictEqual(
      report.players.B.worst.map((x) => x.vertex),
      ['T1'],
    )
  })

  it('reports no costliest moves at all for a flawless game', () => {
    let report = summarizeVerdicts([
      verdict(1, 'B', 'D4', 0, 0.1),
      verdict(2, 'W', 'Q16', 0, 0.0),
    ])

    assert.deepStrictEqual(report.players.B.worst, [])
    assert.deepStrictEqual(report.players.W.worst, [])
    // ยังต้องนับหมากและรวมแต้มตามปกติ
    assert.strictEqual(report.players.B.totalLoss, 0.1)
    assert.deepStrictEqual(report.players.B.counts, [1, 0, 0, 0, 0])
  })

  it('breaks ties by move order so the report does not reshuffle', () => {
    let report = summarizeVerdicts([
      verdict(5, 'B', 'T1', 3, 4.0),
      verdict(1, 'B', 'D4', 3, 4.0),
      verdict(3, 'B', 'C3', 3, 4.0),
    ])

    assert.deepStrictEqual(
      report.players.B.worst.map((x) => x.moveNumber),
      [1, 3, 5],
    )
  })

  // A move with no measurable loss must not be silently counted as flawless —
  // that would flatter the player with exactly the moves the engine ignored.
  it('counts unmeasured moves as played but not as good', () => {
    let report = summarizeVerdicts([
      verdict(1, 'B', 'D4', 3, 4.0),
      unmeasured(3, 'B', 'A1'),
    ])

    assert.strictEqual(report.players.B.moves, 2)
    assert.strictEqual(report.measured, 1)
    assert.deepStrictEqual(report.players.B.counts, [0, 0, 0, 1, 0])
    assert.strictEqual(report.players.B.totalLoss, 4)

    // มีหมากพลาดจริงอยู่ในรายการ แต่หมากที่วัดไม่ได้ต้องไม่ถูกจัดอันดับด้วย
    assert.deepStrictEqual(
      report.players.B.worst.map((x) => x.vertex),
      ['D4'],
    )
  })

  it('handles a game with no verdicts at all', () => {
    let report = summarizeVerdicts([])

    assert.strictEqual(report.moves, 0)
    assert.strictEqual(report.measured, 0)
    assert.strictEqual(report.players.B.averageLoss, 0)
    assert.deepStrictEqual(report.turningPoints, [])
  })
})

describe('blackLeadBefore', () => {
  it('reports White’s lead from Black’s side of the axis', () => {
    assert.strictEqual(
      blackLeadBefore(verdict(1, 'B', 'D4', 0, 0, 3.5).event),
      3.5,
    )
    assert.strictEqual(
      blackLeadBefore(verdict(2, 'W', 'Q16', 0, 0, 3.5).event),
      -3.5,
    )
  })

  it('is null when the engine reported no score lead', () => {
    assert.strictEqual(blackLeadBefore(verdict(1, 'B', 'D4', 0, 0).event), null)
  })
})

describe('findTurningPoints', () => {
  it('attributes the swing to the move that caused it', () => {
    // Black leads by 2 before move 1; White leads by 8 before move 2, so move 1
    // is what handed the lead over.
    let points = findTurningPoints([
      verdict(1, 'B', 'A1', 4, 10.0, 2.0),
      verdict(2, 'W', 'Q16', 0, 0.1, 8.0),
    ])

    assert.strictEqual(points.length, 1)
    assert.strictEqual(points[0].moveNumber, 1)
    assert.strictEqual(points[0].vertex, 'A1')
    assert.strictEqual(points[0].leadBefore, 2)
    assert.strictEqual(points[0].leadAfter, -8)
  })

  it('ignores a lead that never changes hands', () => {
    let points = findTurningPoints([
      verdict(1, 'B', 'D4', 0, 0.1, 5.0),
      verdict(2, 'W', 'Q16', 0, 0.1, -3.0), // Black still ahead by 3
    ])

    assert.deepStrictEqual(points, [])
  })

  // Around an even game the sign flips constantly on search noise; those are
  // not moments worth reviewing.
  it('ignores sign flips too small to matter', () => {
    let points = findTurningPoints([
      verdict(1, 'B', 'D4', 0, 0.1, 0.2),
      verdict(2, 'W', 'Q16', 0, 0.1, 0.3), // Black −0.3: flipped, but by 0.5
    ])

    assert.deepStrictEqual(points, [])
  })

  it('skips moves the engine gave no score lead for', () => {
    let points = findTurningPoints([
      verdict(1, 'B', 'D4', 0, 0.1),
      verdict(2, 'W', 'Q16', 0, 0.1, 8.0),
    ])

    assert.deepStrictEqual(points, [])
  })

  it('keeps the biggest swings but reports them in move order', () => {
    let points = findTurningPoints(
      [
        verdict(1, 'B', 'A1', 4, 10, 1.0),
        verdict(2, 'W', 'B2', 4, 10, 2.0), // Black −2: small flip
        verdict(3, 'B', 'C3', 4, 10, -2.0), // Black −2 → flip to +20
        verdict(4, 'W', 'D4', 4, 10, -20.0), // Black +20
      ],
      {limit: 1},
    )

    assert.strictEqual(points.length, 1)
    assert.strictEqual(points[0].moveNumber, 3)
  })
})

describe('listReviewableNodes', () => {
  // Reviewing walks this list, so the order has to reach a parent before its
  // children: a move can only be judged from the position before it.
  const tree = {
    *listNodes() {
      yield {id: 'root', parentId: null, data: {}}
      yield {id: 'n1', parentId: 'root', data: {B: ['dp']}}
      yield {id: 'n2a', parentId: 'n1', data: {W: ['pd']}}
      yield {id: 'n3a', parentId: 'n2a', data: {B: ['dd']}}
      yield {id: 'n2b', parentId: 'n1', data: {W: ['pp']}}
    },
  }

  it('lists moves in depth-first order, parents before children', () => {
    assert.deepStrictEqual(
      listReviewableNodes(tree).map((n) => n.id),
      ['n1', 'n2a', 'n3a', 'n2b'],
    )
  })

  // A line the player explored is part of what they were thinking; skipping it
  // would leave the panel blank exactly when they switch to it.
  it('includes variations, not only the main line', () => {
    assert.ok(listReviewableNodes(tree).some((n) => n.id === 'n2b'))
  })

  it('skips nodes that record no move, such as the root', () => {
    assert.ok(!listReviewableNodes(tree).some((n) => n.id === 'root'))
  })

  it('returns nothing for an empty game', () => {
    let empty = {
      *listNodes() {
        yield {id: 'root', parentId: null, data: {}}
      },
    }
    assert.deepStrictEqual(listReviewableNodes(empty), [])
  })
})

describe('collectVerdicts', () => {
  // Minimal stand-in for @sabaki/immutable-gametree: the collector only walks
  // `root`, `children` and `id`.
  const tree = {
    root: {
      id: 'root',
      children: [
        {
          id: 'n1',
          children: [
            {id: 'n2a', children: []},
            {id: 'n2b', children: [{id: 'n3b', children: []}]},
          ],
        },
      ],
    },
  }

  it('follows the first child by default', () => {
    let coachByNode = {n1: {moveNumber: 1}, n2a: {moveNumber: 2}}
    let verdicts = collectVerdicts(tree, {}, coachByNode)

    assert.deepStrictEqual(
      verdicts.map((x) => x.nodeId),
      ['n1', 'n2a'],
    )
  })

  // A `currents` entry records the chosen child's id, not its index. Getting
  // this wrong walks off the tree at the first fork and silently reports an
  // empty game.
  it('follows the variation the player is actually viewing', () => {
    let coachByNode = {n1: {}, n2a: {}, n2b: {}, n3b: {}}
    let verdicts = collectVerdicts(tree, {n1: 'n2b'}, coachByNode)

    assert.deepStrictEqual(
      verdicts.map((x) => x.nodeId),
      ['n1', 'n2b', 'n3b'],
    )
  })

  it('stops when a recorded child id is no longer in the tree', () => {
    let verdicts = collectVerdicts(tree, {n1: 'deleted'}, {n1: {}, n2a: {}})

    assert.deepStrictEqual(
      verdicts.map((x) => x.nodeId),
      ['n1'],
    )
  })

  it('skips nodes the coach never judged', () => {
    let verdicts = collectVerdicts(tree, {}, {n2a: {moveNumber: 2}})

    assert.deepStrictEqual(
      verdicts.map((x) => x.nodeId),
      ['n2a'],
    )
  })
})
