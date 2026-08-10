import {h, Component} from 'preact'
import classNames from 'classnames'

import Drawer from './Drawer.js'
import i18n from '../../i18n.js'
import sabaki from '../../modules/sabaki.js'
import {levelPresets, defaultLevel, downloads} from '../../coachlevels.js'

const t = i18n.context('CoachSetupDrawer')

// The screen a learner sees the first time they open the app.
//
// Everything it asks for used to be assembled by hand: download KataGo from a
// release page, a neural network from a model repository, write a .cfg, write a
// JSON config with absolute paths in it, then type two of those paths into
// Manage Engines. Nobody who wanted to learn Go was going to do that.
//
// It asks for one thing -- how strong you are -- because that answer is not
// guessable and it changes what the coach says. Everything else it works out.

const downloadSize = `${Math.round(
  downloads.reduce((sum, step) => sum + step.approximateBytes, 0) / 1e6,
)} MB`

export default class CoachSetupDrawer extends Component {
  constructor(props) {
    super(props)

    this.state = {
      level: defaultLevel,
      status: null,
      progress: null,
      busy: false,
      error: null,
    }

    this.handleLevelChange = (level) => () => this.setState({level})

    this.handleDownload = async () => {
      this.setState({busy: true, error: null})

      try {
        await window.sabaki.coach.download()
        await this.refreshStatus()
      } catch (err) {
        this.setState({error: err.message})
      } finally {
        this.setState({busy: false, progress: null})
      }
    }

    this.handleChooseDirectory = async () => {
      let directory = await window.sabaki.coach.chooseDirectory()
      if (directory == null) return

      this.setState({busy: true, error: null})

      try {
        await window.sabaki.coach.write({level: this.state.level, directory})
        await this.refreshStatus()
      } catch (err) {
        this.setState({error: err.message})
      } finally {
        this.setState({busy: false})
      }
    }

    this.handleFinish = async () => {
      this.setState({busy: true, error: null})

      try {
        await window.sabaki.coach.write({level: this.state.level})
        sabaki.closeDrawer()
      } catch (err) {
        this.setState({error: err.message})
      } finally {
        this.setState({busy: false})
      }
    }

    this.handleSkip = () => sabaki.closeDrawer()
  }

  async refreshStatus() {
    let status = await window.sabaki.coach.getStatus()
    this.setState((state) => ({
      status,
      level: status.level ?? state.level,
    }))
  }

  componentDidMount() {
    this.stopListening = window.sabaki.coach.onProgress((progress) =>
      this.setState({progress}),
    )

    this.refreshStatus()
  }

  componentWillUnmount() {
    this.stopListening?.()
  }

  componentWillReceiveProps({show}) {
    if (show && !this.props.show) this.refreshStatus()
  }

  renderProgress() {
    let {progress} = this.state
    if (progress == null) return null

    let percent =
      progress.total > 0
        ? Math.round((progress.received / progress.total) * 100)
        : 0

    return h(
      'div',
      {class: 'progress'},
      h(
        'p',
        {},
        t((p) => `Downloading ${p.name} (${p.step} of ${p.steps})`, {
          name: progress.name,
          step: progress.step,
          steps: progress.steps,
        }),
      ),
      h('div', {class: 'bar'}, h('div', {style: {width: `${percent}%`}})),
      h('p', {class: 'detail'}, `${percent}%`),
    )
  }

  render({show}, {level, status, busy, error}) {
    let ready = status?.katagoPath != null

    return h(
      Drawer,
      {type: 'coachsetup', show},

      h('h2', {}, t('Set Up the Coach')),

      h(
        'p',
        {class: 'intro'},
        t(
          'Tell the coach how strong you are and it will grade against that level. Losing one point is nothing for a beginner and a clear mistake for a dan player.',
        ),
      ),

      h(
        'ul',
        {class: 'levels'},
        Object.entries(levelPresets).map(([name, preset]) =>
          h(
            'li',
            {
              key: name,
              class: classNames('level', {selected: level === name}),
              onClick: this.handleLevelChange(name),
            },
            h('span', {class: 'name'}, preset.label),
            h('span', {class: 'hint'}, preset.hint),
          ),
        ),
      ),

      h('h3', {}, t('Analysis engine (KataGo)')),

      ready
        ? h(
            'p',
            {class: 'found'},
            t((p) => `Ready: ${p.path}`, {path: status.katagoPath}),
          )
        : h(
            'p',
            {class: 'missing'},
            t(
              (p) =>
                `Not on this computer yet. About ${p.size} to download, once, over the internet.`,
              {size: downloadSize},
            ),
          ),

      this.renderProgress(),

      error != null ? h('p', {class: 'error'}, error) : null,

      h(
        'p',
        {class: 'actions'},
        !ready
          ? h(
              'button',
              {class: 'primary', disabled: busy, onClick: this.handleDownload},
              t('Download It for Me'),
            )
          : null,

        h(
          'button',
          {disabled: busy, onClick: this.handleChooseDirectory},
          t('I Already Have KataGo…'),
        ),

        ready
          ? h(
              'button',
              {class: 'primary', disabled: busy, onClick: this.handleFinish},
              t('Start Coaching'),
            )
          : h('button', {disabled: busy, onClick: this.handleSkip}, t('Later')),
      ),
    )
  }
}
