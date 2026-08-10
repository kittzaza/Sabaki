// Naming the shape a move makes, in Thai.
//
// A point loss says how much a move cost; it does not say what the move was.
// "Q16 คือจุดดาว" or "ตาที่แนะนำเป็นการต่อ" gives a learner the vocabulary to
// look the idea up and to recognise it next time, which a number cannot.
//
// The matching itself is @sabaki/boardmatcher, already a dependency and already
// used to title comments. Only the naming is ours.
//
// These are Go vocabulary — nouns for shapes — not the coach's judgement of a
// move, which still comes from the proxy. They live here rather than in the
// proxy because matching needs the board, which only Sabaki has.

import boardmatcher from '@sabaki/boardmatcher'
import * as gametree from './gametree.js'

// Keys are the pattern names in @sabaki/boardmatcher's library. A name with no
// entry is shown untranslated rather than hidden: an English shape name is
// still more use to a learner than silence, and it makes a gap obvious.
const shapeNamesTh = {
  '3-3 Point': 'จุด 3-3',
  '3-3 Point Invasion': 'บุกจุด 3-3',
  '3-4 Point': 'จุด 3-4',
  '3-5 Point': 'จุด 3-5',
  '4-4 Point': 'จุดดาว (4-4)',
  '4-5 Point': 'จุด 4-5',
  '5-5 Point': 'จุด 5-5',
  '6-3 Point': 'จุด 6-3',
  '6-4 Point': 'จุด 6-4',
  Attachment: 'แปะติด',
  'Bamboo Joint': 'ข้อไผ่',
  'Big Bulge': 'ป่องใหญ่',
  Cut: 'ตัด',
  Diagonal: 'ทแยง',
  'Diagonal Jump': 'กระโดดทแยง',
  Diamond: 'ข้าวหลามตัด',
  'Dog’s Head': 'หัวสุนัข',
  'Empty Triangle': 'สามเหลี่ยมกลวง',
  'Enclosure Opening': 'เปิดเกมแบบปิดมุม',
  Hane: 'ฮาเนะ (พับข้าม)',
  'High Approach': 'เข้าหาแบบสูง',
  'High Chinese Opening': 'เปิดเกมจีนสูง',
  'High Enclosure': 'ปิดมุมแบบสูง',
  'Horse’s Head': 'หัวม้า',
  'Kobayashi Opening': 'เปิดเกมโคบายาชิ',
  'Large Knight': 'ม้าใหญ่',
  'Low Approach': 'เข้าหาแบบต่ำ',
  'Low Chinese Opening': 'เปิดเกมจีนต่ำ',
  'Low Enclosure': 'ปิดมุมแบบต่ำ',
  'Micro Chinese Opening': 'เปิดเกมจีนจิ๋ว',
  'Mouth Shape': 'รูปปาก',
  'Nirensei Opening': 'เปิดเกมนิเร็นเซ (ดาวสองจุด)',
  'One-Point Jump': 'กระโดดหนึ่งช่อง',
  'Orthodox Opening': 'เปิดเกมแบบดั้งเดิม',
  Parallelogram: 'สี่เหลี่ยมด้านขนาน',
  'Sanrensei Opening': 'เปิดเกมซันเร็นเซ (ดาวสามจุด)',
  'Shoulder Hit': 'ตีบ่า',
  'Shūsaku Opening': 'เปิดเกมชูซากุ',
  'Small Chinese Opening': 'เปิดเกมจีนเล็ก',
  'Small Knight': 'ม้าเล็ก',
  Square: 'สี่เหลี่ยมจัตุรัส',
  Stretch: 'ต่อยืด',
  'Table Shape': 'รูปโต๊ะ',
  'Throwing Star': 'ดาวกระจาย',
  'Tiger’s Mouth': 'ปากเสือ',
  'Tippy Table': 'โต๊ะเอียง',
  Trapezium: 'สี่เหลี่ยมคางหมู',
  Turn: 'หักมุม',
  'Two-Point Jump': 'กระโดดสองช่อง',
  Wedge: 'แทรกกลาง',
}

export function translateShape(name) {
  return name == null ? null : shapeNamesTh[name] || name
}

/**
 * Names the shape a move would make, given the position before it is played.
 *
 * `vertex` is a GTP coordinate such as "Q16", matching what the coach reports.
 * Returns null when the move makes no shape the library recognises, which is
 * the common case in the middle of a fight — saying nothing is better than
 * inventing a name.
 */
export function describeMove(tree, parentId, color, vertex) {
  if (parentId == null || typeof vertex !== 'string') return null

  let board = gametree.getBoard(tree, parentId)
  if (board == null) return null

  let coordinates
  try {
    coordinates = board.parseVertex(vertex)
  } catch (err) {
    return null
  }
  if (coordinates == null || !board.has(coordinates)) return null

  let match = boardmatcher.findPatternInMove(
    board.signMap,
    color === 'W' ? -1 : 1,
    coordinates,
  )

  return match == null ? null : translateShape(match.pattern.name)
}

/**
 * Shape names for one verdict: the move that was played, and the move the coach
 * recommends instead. Both are measured from the same position — the one before
 * the move — so they are directly comparable.
 */
export function describeVerdict(tree, nodeId, event) {
  if (tree == null || nodeId == null || event == null) return null

  let node = tree.get(nodeId)
  if (node == null) return null

  let played = describeMove(tree, node.parentId, event.color, event.vertex)
  let best =
    event.best == null
      ? null
      : describeMove(tree, node.parentId, event.color, event.best.vertex)

  // Naming both with the same word teaches nothing and reads like a mistake.
  if (played != null && played === best) return {played, best: null}

  return played == null && best == null ? null : {played, best}
}
