import {h, Component} from 'preact'

import SplitContainer from './helpers/SplitContainer.js'
import TripleSplitContainer from './helpers/TripleSplitContainer.js'
import CoachPanel from './sidebars/CoachPanel.js'
import GtpConsole from './sidebars/GtpConsole.js'
import {EnginePeerList} from './sidebars/PeerList.js'
import {collectVerdicts, summarizeVerdicts} from '../modules/coachsummary.js'
import {describeVerdict} from '../modules/coachshapes.js'

const setting = {
  get: (key) => window.sabaki.setting.get(key),
  set: (key, value) => window.sabaki.setting.set(key, value),
}
const peerListMinHeight = setting.get('view.peerlist_minheight')
const gtpConsoleMinHeight = setting.get('view.gtpconsole_minheight')

export default class LeftSidebar extends Component {
  constructor() {
    super()

    this.state = {
      peerListHeight: setting.get('view.peerlist_height'),
      gtpConsoleHeight: setting.get('view.gtpconsole_height'),
      selectedEngineSyncerId: null,
    }

    this.handlePeerListHeightChange = ({sideSize}) => {
      this.setState({peerListHeight: Math.max(sideSize, peerListMinHeight)})
    }

    this.handlePeerListHeightFinish = () => {
      setting.set('view.peerlist_height', this.state.peerListHeight)
    }

    this.handleTripleSplitChange = ({beginSideSize, endSideSize}) => {
      this.setState({
        peerListHeight: Math.max(beginSideSize, peerListMinHeight),
        gtpConsoleHeight: Math.max(endSideSize, gtpConsoleMinHeight),
      })
    }

    this.handleTripleSplitFinish = () => {
      setting
        .set('view.peerlist_height', this.state.peerListHeight)
        .set('view.gtpconsole_height', this.state.gtpConsoleHeight)
    }

    this.handleCommandControlStep = ({step}) => {
      let {attachedEngineSyncers} = this.props
      let engineIndex = attachedEngineSyncers.findIndex(
        (syncer) => syncer.id === this.state.selectedEngineSyncerId,
      )

      let stepEngineIndex = Math.min(
        Math.max(0, engineIndex + step),
        attachedEngineSyncers.length - 1,
      )
      let stepEngine = this.props.attachedEngineSyncers[stepEngineIndex]

      if (stepEngine != null) {
        this.setState({selectedEngineSyncerId: stepEngine.id})
      }
    }

    this.handleEngineSelect = ({syncer}) => {
      this.setState({selectedEngineSyncerId: syncer.id}, () => {
        let input = this.element.querySelector('.gtp-console .input .command')

        if (input != null) {
          input.focus()
        }
      })
    }

    this.handleCommandSubmit = ({command}) => {
      let syncer = this.props.attachedEngineSyncers.find(
        (syncer) => syncer.id === this.state.selectedEngineSyncerId,
      )

      if (syncer != null) {
        syncer.queueCommand(command)
      }
    }
  }

  shouldComponentUpdate(nextProps) {
    return (
      nextProps.showLeftSidebar != this.props.showLeftSidebar ||
      nextProps.showLeftSidebar
    )
  }

  // The report walks the whole game line, and this component re-renders on
  // every app state change while the sidebar is open, so it is cached.
  //
  // Keyed on treePosition rather than on the currents map, because Sabaki
  // mutates that map in place when you navigate: comparing it by identity would
  // never invalidate, leaving the report frozen on whichever variation happened
  // to be open first. treePosition changes whenever the line on screen can.
  getCoachReport(tree, gameCurrent, treePosition, coachByNode) {
    if (
      this.reportCache == null ||
      this.reportCache.tree !== tree ||
      this.reportCache.treePosition !== treePosition ||
      this.reportCache.coachByNode !== coachByNode
    ) {
      this.reportCache = {
        tree,
        treePosition,
        coachByNode,
        report: summarizeVerdicts(
          collectVerdicts(tree, gameCurrent, coachByNode),
        ),
      }
    }

    return this.reportCache.report
  }

  render(
    {
      attachedEngineSyncers,
      analyzingEngineSyncerId,
      blackEngineSyncerId,
      whiteEngineSyncerId,
      engineGameOngoing,
      showLeftSidebar,
      showCoachPanel,
      consoleLog,
      coachMessages,
      coachByNode,
      coachReview,
      coachCriteria,
      treePosition,
      gameTrees,
      gameIndex,
      gameCurrents,
    },
    {peerListHeight, gtpConsoleHeight, selectedEngineSyncerId},
  ) {
    let peerList = h(EnginePeerList, {
      attachedEngineSyncers,
      analyzingEngineSyncerId,
      blackEngineSyncerId,
      whiteEngineSyncerId,
      selectedEngineSyncerId,
      engineGameOngoing,

      onEngineSelect: this.handleEngineSelect,
    })

    let gtpConsole = h(GtpConsole, {
      show: showLeftSidebar,
      consoleLog,
      attachedEngine: attachedEngineSyncers
        .map((syncer) =>
          syncer.id !== selectedEngineSyncerId
            ? null
            : {
                name: syncer.engine.name,
                get commands() {
                  return syncer.commands
                },
              },
        )
        .find((x) => x != null),

      onSubmit: this.handleCommandSubmit,
      onControlStep: this.handleCommandControlStep,
    })

    return h(
      'section',
      {
        ref: (el) => (this.element = el),
        id: 'leftsidebar',
      },

      !showCoachPanel
        ? h(SplitContainer, {
            vertical: true,
            invert: true,
            sideSize: peerListHeight,

            sideContent: peerList,
            mainContent: gtpConsole,

            onChange: this.handlePeerListHeightChange,
            onFinish: this.handlePeerListHeightFinish,
          })
        : h(TripleSplitContainer, {
            vertical: true,
            beginSideSize: peerListHeight,
            endSideSize: gtpConsoleHeight,

            beginSideContent: peerList,

            // The coach panel takes the flexible middle: it is what the learner
            // reads, so it gets the space left over from the two fixed panes.
            mainContent: h(CoachPanel, {
              show: showLeftSidebar,
              attached: attachedEngineSyncers.length > 0,
              coachMessages,
              currentVerdict: coachByNode[treePosition],
              // Shape names are worked out here rather than in the panel because
              // naming a move needs the board, and only this side has the tree.
              currentShapes: describeVerdict(
                gameTrees[gameIndex],
                treePosition,
                coachByNode[treePosition],
              ),
              review: coachReview,
              criteria: coachCriteria,
              report: this.getCoachReport(
                gameTrees[gameIndex],
                gameCurrents[gameIndex],
                treePosition,
                coachByNode,
              ),
            }),

            endSideContent: gtpConsole,

            onChange: this.handleTripleSplitChange,
            onFinish: this.handleTripleSplitFinish,
          }),
    )
  }
}

LeftSidebar.getDerivedStateFromProps = (props, state) => {
  if (
    props.attachedEngineSyncers.length > 0 &&
    props.attachedEngineSyncers.find(
      (syncer) => syncer.id === state.selectedEngineSyncerId,
    ) == null
  ) {
    return {selectedEngineSyncerId: props.attachedEngineSyncers[0].id}
  } else if (props.attachedEngineSyncers.length === 0) {
    return {selectedEngineSyncerId: null}
  }
}
