// Persisting coach verdicts inside the SGF file.
//
// Without this, a review lives only in memory: close the window and the reason
// a move was bad is gone, which makes reviewing a long game a waste of effort.
//
// Verdicts go into a private SGF property rather than the comment field. `C`
// belongs to the player -- overwriting it would delete notes they wrote
// themselves -- and Sabaki already sets the precedent for private properties
// with SBKV and SBKS, which unknown-property round-tripping preserves in any
// conforming SGF tool.
//
// The whole verdict event is stored, Thai wording included, so a saved review
// reads back exactly as it was written. Re-deriving the sentences here instead
// would mean maintaining the same phrasing in two languages in two code bases,
// which is precisely what the proxy boundary exists to avoid.

export const coachProperty = 'TGCV'

/**
 * Serialises one verdict event for storage in an SGF property value.
 *
 * The proxy escapes non-ASCII on the wire so a split stderr chunk cannot
 * corrupt Thai mid-character; that concern does not apply here, so the text is
 * stored as real Unicode and the file stays readable and roughly a third the
 * size.
 */
export function encodeVerdict(event) {
  return JSON.stringify(event)
}

/**
 * Reads one stored verdict back.
 *
 * Returns null for anything unusable -- a hand-edited file, a value written by
 * a newer version, a truncated write. A review that cannot be read back is
 * worth skipping; it is never worth refusing to open the game over.
 */
export function decodeVerdict(raw) {
  if (typeof raw !== 'string' || raw === '') return null

  let event
  try {
    event = JSON.parse(raw)
  } catch (err) {
    return null
  }

  if (event == null || typeof event !== 'object') return null
  if (event.type !== 'verdict') return null
  if (typeof event.vertex !== 'string') return null
  if (!Array.isArray(event.lines)) return null

  return event
}

/**
 * Collects every stored verdict in a game tree, keyed by node id.
 *
 * Walks all nodes rather than the current line: a variation reviewed earlier
 * keeps its commentary, and switching to it shows that commentary again.
 */
export function readVerdicts(tree) {
  let result = {}

  for (let node of tree.listNodes()) {
    let values = node.data[coachProperty]
    if (values == null || values.length === 0) continue

    let event = decodeVerdict(values[0])
    if (event != null) result[node.id] = event
  }

  return result
}
