import {h, Component} from 'preact'
import classNames from 'classnames'

import sabaki from '../../modules/sabaki.js'
import {severityCount} from '../../modules/coachsummary.js'

// Panel for the Thai Go Coach.
//
// Two things are shown, and the distinction matters for a learner:
//
//   * a pinned verdict for the move at the current tree position, so stepping
//     back through a game replays the commentary move by move
//   * the running feed of everything the coach has said, for context
//
// All wording arrives pre-rendered in each event's `lines`, produced by the
// proxy's coach.py. Nothing here composes Thai sentences — that would mean
// maintaining the same phrasing in two languages in two repositories.

// Indexed by the verdict's `severity`, 0 (best) to 4 (worst). Ranking comes
// from the proxy as a number so nothing here has to interpret Thai wording.
const severityClasses = ['excellent', 'good', 'fair', 'mistake', 'blunder']

const severityClass = (severity) =>
  typeof severity === 'number'
    ? severityClasses[severity] || 'neutral'
    : 'neutral'

class CoachVerdict extends Component {
  shouldComponentUpdate({event}) {
    return event !== this.props.event
  }

  render({event, pinned}) {
    let {label, vertex, loss, lossUnit, severity, lines} = event

    let lossText =
      loss == null
        ? null
        : lossUnit === 'winrate'
          ? `−${loss.toFixed(1)}%`
          : `−${loss.toFixed(1)}`

    return h(
      'div',
      {class: classNames('coach-verdict', severityClass(severity), {pinned})},

      // The headline restates line 0 compactly so severity can be colour-coded
      // and the point loss aligned. Everything below is the proxy's own wording,
      // rendered as-is — the engine's assessment and recommended line are
      // already in those lines, so nothing here repeats them.
      h(
        'div',
        {class: 'headline'},
        h('span', {class: 'vertex'}, vertex),
        h('span', {class: 'label'}, label),
        lossText != null ? h('span', {class: 'loss'}, lossText) : null,
      ),

      h(
        'div',
        {class: 'body'},
        lines.slice(1).map((line) => h('p', {}, stripPrefix(line))),
      ),
    )
  }
}

class CoachPosition extends Component {
  shouldComponentUpdate({event}) {
    return event !== this.props.event
  }

  render({event}) {
    return h(
      'div',
      {class: 'coach-position'},
      event.lines.map((line) => h('p', {}, stripPrefix(line))),
    )
  }
}

// The '[โค้ช]' tag exists so the lines stand out in the raw GTP console. In a
// panel that only ever shows coach output it is noise on every line.
function stripPrefix(line) {
  return line.replace(/^\[โค้ช\]\s*/, '')
}

// Labels for the whole-game report. These name parts of the UI rather than
// judge anything — every judgement word (ยอดเยี่ยม, พลาด, …) still comes from
// the proxy inside the verdict events.
const summaryText = {
  title: 'สรุปทั้งเกม',
  black: 'ดำ',
  white: 'ขาว',
  totalLoss: 'เสียรวม',
  worstMoves: 'หมากที่เสียมากที่สุด',
  turningPoints: 'จุดพลิกเกม',
  move: 'หมากที่',
  points: 'แต้ม',
  movesUnit: 'หมาก',
  leadFlip: 'พลิกเป็น',
  noneYet: 'ยังไม่มีหมากที่วิเคราะห์แล้ว',
  unmeasured: 'วัดไม่ได้',
  toggleShow: 'ดูสรุปทั้งเกม',
  toggleHide: 'ซ่อนสรุป',
  review: 'รีวิวทั้งเกม',
  reviewing: 'กำลังรีวิว',
  cancel: 'ยกเลิก',
}

function goToNode(nodeId) {
  let {gameTrees, gameIndex} = sabaki.state
  sabaki.setCurrentTreePosition(gameTrees[gameIndex], nodeId)
}

// One clickable reference to a move, so a learner can jump straight to the
// position being talked about instead of hunting for it on the board.
function moveLink(entry, extra) {
  return h(
    'li',
    {class: severityClass(entry.severity)},
    h(
      'a',
      {
        href: '#',
        onClick: (evt) => {
          evt.preventDefault()
          goToNode(entry.nodeId)
        },
      },
      `${summaryText.move} ${entry.moveNumber} (${entry.vertex})`,
    ),
    h('span', {class: 'detail'}, extra),
  )
}

class CoachSummary extends Component {
  shouldComponentUpdate({report, expanded}) {
    return report !== this.props.report || expanded !== this.props.expanded
  }

  renderPlayer(key, label) {
    let player = this.props.report.players[key]

    // A player with nothing judged yet gets no row at all. Printing
    // "เสียรวม 0 แต้ม" for them would read as a flawless game rather than as an
    // absence of data.
    if (player.moves === 0) return null

    let judged = player.counts.reduce((sum, n) => sum + n, 0)

    return h(
      'div',
      {class: 'player'},
      h('span', {class: 'who'}, label),
      h(
        'span',
        {class: 'counts'},
        Array.from({length: severityCount}, (_, severity) =>
          player.counts[severity] === 0
            ? null
            : h(
                'span',
                {class: classNames('tally', severityClasses[severity])},
                player.counts[severity],
              ),
        ),
      ),
      h(
        'span',
        {class: 'total'},
        judged === 0
          ? summaryText.unmeasured
          : `${summaryText.totalLoss} ${player.totalLoss} ${summaryText.points} / ${judged} ${summaryText.movesUnit}`,
      ),
    )
  }

  render({report, expanded, onToggle}) {
    let worst = [...report.players.B.worst, ...report.players.W.worst]
      .sort((a, b) => b.loss - a.loss)
      .slice(0, 3)

    return h(
      'div',
      {class: 'coach-summary'},

      h(
        'div',
        {class: 'summary-header', onClick: onToggle},
        h('span', {class: 'title'}, summaryText.title),
        h(
          'span',
          {class: 'toggle'},
          expanded ? summaryText.toggleHide : summaryText.toggleShow,
        ),
      ),

      !expanded
        ? null
        : report.measured === 0
          ? h('p', {class: 'placeholder'}, summaryText.noneYet)
          : [
              this.renderPlayer('B', summaryText.black),
              this.renderPlayer('W', summaryText.white),

              worst.length === 0
                ? null
                : h(
                    'div',
                    {class: 'section'},
                    h('div', {class: 'section-title'}, summaryText.worstMoves),
                    h(
                      'ul',
                      {},
                      worst.map((entry) =>
                        moveLink(
                          entry,
                          `${entry.label} −${entry.loss.toFixed(1)}`,
                        ),
                      ),
                    ),
                  ),

              report.turningPoints.length === 0
                ? null
                : h(
                    'div',
                    {class: 'section'},
                    h(
                      'div',
                      {class: 'section-title'},
                      summaryText.turningPoints,
                    ),
                    h(
                      'ul',
                      {},
                      report.turningPoints.map((point) =>
                        moveLink(
                          {...point, severity: null},
                          `${summaryText.leadFlip} ${formatLead(point.leadBefore)} → ${formatLead(point.leadAfter)}`,
                        ),
                      ),
                    ),
                  ),
            ],
    )
  }
}

// Leads are on Black's axis; the sign alone does not say who is ahead, so name
// the player. Without this the reader has to remember the convention.
function formatLead(lead) {
  let who = lead >= 0 ? summaryText.black : summaryText.white
  return `${who} +${Math.abs(lead).toFixed(1)}`
}

export default class CoachPanel extends Component {
  constructor() {
    super()

    this.state = {summaryExpanded: false}

    this.handleSummaryToggle = () => {
      this.setState(({summaryExpanded}) => ({
        summaryExpanded: !summaryExpanded,
      }))
    }
  }

  componentWillUpdate() {
    if (this.scrollElement == null) return

    let {scrollTop, scrollHeight, offsetHeight} = this.scrollElement
    this.scrollToBottom = scrollTop >= scrollHeight - offsetHeight - 4
  }

  componentDidUpdate(prevProps) {
    if (this.scrollElement == null) return

    // Follow new advice only when the reader is already at the bottom, so
    // scrolling up to re-read an earlier comment is not yanked away.
    if ((!prevProps.show && this.props.show) || this.scrollToBottom) {
      this.scrollElement.scrollTop = this.scrollElement.scrollHeight
    }
  }

  render(
    {coachMessages, currentVerdict, attached, report, review},
    {summaryExpanded},
  ) {
    let empty = coachMessages.length === 0

    return h(
      'section',
      {class: classNames('coach-panel', {'summary-open': summaryExpanded})},

      h(
        'div',
        {class: 'header'},
        h('span', {class: 'title'}, 'โค้ชโกะ'),
        !attached ? h('span', {class: 'hint'}, 'ยังไม่ได้ต่อ engine') : null,

        review != null
          ? [
              h(
                'span',
                {class: 'review-progress'},
                `${summaryText.reviewing} ${review.current}/${review.total}`,
              ),
              h(
                'button',
                {
                  class: 'review-button',
                  onClick: () => sabaki.stopCoachReview(),
                },
                summaryText.cancel,
              ),
            ]
          : h(
              'button',
              {
                class: 'review-button',
                disabled: !attached,
                onClick: () => sabaki.startCoachReview(),
              },
              summaryText.review,
            ),
      ),

      review != null
        ? h('div', {
            class: 'review-bar',
            style: {
              width: `${Math.round((review.current / Math.max(review.total, 1)) * 100)}%`,
            },
          })
        : null,

      report != null && report.moves > 0
        ? h(CoachSummary, {
            report,
            expanded: summaryExpanded,
            onToggle: this.handleSummaryToggle,
          })
        : null,

      currentVerdict != null
        ? h(CoachVerdict, {event: currentVerdict, pinned: true})
        : null,

      h(
        'div',
        {
          ref: (el) => (this.scrollElement = el),
          class: 'feed',
        },

        empty
          ? h(
              'p',
              {class: 'placeholder'},
              attached
                ? 'เปิดการวิเคราะห์แล้วเดินหมาก คำแนะนำจะขึ้นที่นี่'
                : 'ต่อ engine โค้ชก่อน แล้วเปิดการวิเคราะห์',
            )
          : coachMessages.map((event, i) =>
              event.type === 'verdict'
                ? h(CoachVerdict, {key: i, event, pinned: false})
                : h(CoachPosition, {key: i, event}),
            ),
      ),
    )
  }
}
