// Finding the coach engine and putting it in the engine list by itself.
//
// Before this, using the coach meant opening Manage Engines and typing the
// absolute path of a Python interpreter and of run_coach.py. That is a
// reasonable thing to ask of the person who wrote it and of nobody else.
//
// This runs in the main process, so it lives at the src root rather than under
// src/modules -- build.files drops src/modules from the package, and requiring
// it from main.js would crash the installed app (see test/packagingTests.js).

const {app} = require('electron')
const {existsSync} = require('fs')
const {join, resolve} = require('path')

const setting = require('./setting')

// A stable id, so the entry can be found again on later launches whatever the
// user has renamed it to, and so re-registering updates it instead of adding a
// second copy.
const coachEngineId = 'coach-go-engine'

const executableName =
  process.platform === 'win32' ? 'thai-go-coach.exe' : 'thai-go-coach'

/**
 * The coach engine's config file, holding the path to KataGo and the learner's
 * level. It sits in the user data directory rather than beside the executable:
 * the executable is inside the installation, which an ordinary user cannot
 * write to, and which an update replaces wholesale.
 */
exports.coachConfigPath = join(setting.userDataDirectory, 'coach.json')

/**
 * Where the coach executable is.
 *
 * Packaged, it is shipped in the app's resources. From source it is wherever it
 * was built, or wherever COACH_EXE says -- which is also how the end-to-end
 * tests point the app at a particular build.
 *
 * Returns null when there is nothing to run, rather than a path that does not
 * exist: the caller has to be able to tell the difference to decide whether to
 * offer the setup screen.
 */
exports.coachExecutablePath = function () {
  let candidates = [
    process.env.COACH_EXE,
    app.isPackaged
      ? join(process.resourcesPath, 'coach', executableName)
      : null,
    // The sibling checkout the coach engine is developed in.
    resolve(
      __dirname,
      '..',
      '..',
      'Project_Thai_Go_AI_Coach',
      'dist',
      executableName,
    ),
  ]

  return candidates.find((path) => path != null && existsSync(path)) ?? null
}

/**
 * Puts the coach in the engine list, or brings an existing entry up to date.
 *
 * Idempotent, and it deliberately does not overwrite a name the user has
 * changed: the path is ours to keep correct across updates, the label is
 * theirs. Returns false when there is no executable to point at.
 */
exports.registerCoachEngine = function () {
  let path = exports.coachExecutablePath()
  if (path == null) return false

  let engines = setting.get('engines.list') || []
  let existing = engines.find((engine) => engine.id === coachEngineId)

  let entry = {
    id: coachEngineId,
    name: existing?.name || 'โค้ชโกะ',
    path,
    args: `--config "${exports.coachConfigPath}"`,
    commands: existing?.commands || '',
  }

  let updated =
    existing == null
      ? [entry, ...engines]
      : engines.map((engine) => (engine.id === coachEngineId ? entry : engine))

  // Writing on every launch would rewrite settings.json for no reason and
  // fight with any edit the user is making in another window.
  if (JSON.stringify(updated) !== JSON.stringify(engines)) {
    setting.set('engines.list', updated)
  }

  return true
}

exports.coachEngineId = coachEngineId
