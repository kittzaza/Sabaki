// Aggregates the coach's per-move verdicts into a whole-game report.
//
// This is arithmetic over judgements the coach already made, not judgement of
// its own: severity ranks, point losses and Thai labels all arrive inside the
// verdict events produced by the proxy. Nothing here decides what counts as a
// mistake — it only counts, totals and orders.
//
// Kept free of Preact and of app state so it can be unit-tested directly.

export const severityCount = 5

// A lead swing smaller than this is search noise around an even position, not a
// move that turned the game. Without it, a game hovering near 0 points would
// report a "turning point" on almost every move.
const minTurningPointSwing = 1.0

// Score lead as seen from Black, so leads from both players' verdicts can be
// compared on one axis. A verdict's `best.scoreLead` is the lead of the player
// about to move, measured before that move is played.
export function blackLeadBefore(event) {
  let lead = event.best == null ? null : event.best.scoreLead
  if (lead == null) return null

  return event.color === 'W' ? -lead : lead
}

function emptyPlayer() {
  return {
    moves: 0,
    counts: Array(severityCount).fill(0),
    totalLoss: 0,
    averageLoss: 0,
    worst: [],
  }
}

/**
 * Builds the report from verdicts in play order.
 *
 * `verdicts` is an array of `{nodeId, event}`, oldest move first. Verdicts
 * whose loss could not be measured still count as played moves but contribute
 * no loss and no severity — reporting them as flawless would be a lie.
 *
 * Returns per-player counts and totals, each player's worst moves, and the
 * moves where the lead changed hands.
 */
export function summarizeVerdicts(verdicts, {worstCount = 3} = {}) {
  let players = {B: emptyPlayer(), W: emptyPlayer()}
  let measured = 0

  for (let {nodeId, event} of verdicts) {
    let player = players[event.color === 'W' ? 'W' : 'B']
    player.moves++

    if (typeof event.severity === 'number' && typeof event.loss === 'number') {
      measured++
      player.counts[event.severity]++
      player.totalLoss += event.loss
      player.worst.push({
        nodeId,
        moveNumber: event.moveNumber,
        vertex: event.vertex,
        label: event.label,
        severity: event.severity,
        loss: event.loss,
      })
    }
  }

  for (let key of ['B', 'W']) {
    let player = players[key]
    let measuredMoves = player.counts.reduce((sum, n) => sum + n, 0)

    player.totalLoss = Math.round(player.totalLoss * 10) / 10
    player.averageLoss =
      measuredMoves === 0
        ? 0
        : Math.round((player.totalLoss / measuredMoves) * 10) / 10

    // Ties broken by move order so the report is stable between renders.
    player.worst.sort((a, b) => b.loss - a.loss || a.moveNumber - b.moveNumber)
    player.worst = player.worst.slice(0, worstCount)
  }

  return {
    moves: verdicts.length,
    measured,
    players,
    turningPoints: findTurningPoints(verdicts),
  }
}

/**
 * Moves after which the lead changed hands.
 *
 * The lead before move i and the lead before move i+1 straddle move i, so a
 * sign change between them is caused by move i.
 */
export function findTurningPoints(verdicts, {limit = 3} = {}) {
  let points = []

  for (let i = 0; i < verdicts.length - 1; i++) {
    let before = blackLeadBefore(verdicts[i].event)
    let after = blackLeadBefore(verdicts[i + 1].event)
    if (before == null || after == null) continue

    let changedHands = (before > 0 && after < 0) || (before < 0 && after > 0)
    if (!changedHands) continue
    if (Math.abs(after - before) < minTurningPointSwing) continue

    let {nodeId, event} = verdicts[i]
    points.push({
      nodeId,
      moveNumber: event.moveNumber,
      vertex: event.vertex,
      color: event.color,
      leadBefore: Math.round(before * 10) / 10,
      leadAfter: Math.round(after * 10) / 10,
    })
  }

  // The biggest swings are the ones worth reviewing when there are many.
  return points
    .sort(
      (a, b) =>
        Math.abs(b.leadAfter - b.leadBefore) -
          Math.abs(a.leadAfter - a.leadBefore) || a.moveNumber - b.moveNumber,
    )
    .slice(0, limit)
    .sort((a, b) => a.moveNumber - b.moveNumber)
}

/**
 * Walks the current game line from the root to its end and picks up the coach
 * verdict attached to each node, oldest move first.
 *
 * Follows `gameCurrent` so the line reviewed is the one on screen, not just the
 * all-first-children main line. Note that a `currents` entry holds the **id** of
 * the chosen child, not its index — the traversal here mirrors GameTree's own
 * (see `getCurrentHeight` in @sabaki/immutable-gametree), including stopping
 * when a recorded id no longer exists in the tree.
 */
export function collectVerdicts(tree, gameCurrent, coachByNode) {
  let verdicts = []
  let node = tree.root
  let currents = gameCurrent || {}

  while (node != null) {
    let event = coachByNode[node.id]
    if (event != null) verdicts.push({nodeId: node.id, event})

    node =
      currents[node.id] == null
        ? node.children[0]
        : node.children.find((child) => child.id === currents[node.id])
  }

  return verdicts
}
