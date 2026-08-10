// Fetching KataGo and its networks.
//
// Kept free of any electron import and given its destination as an argument, so
// it can be run for real against the real URLs without launching the app --
// which is the only way to find out whether a download of this size actually
// works. `scripts/downloadKataGo.js` does exactly that.

const {createWriteStream, existsSync, mkdirSync, renameSync} = require('fs')
const {spawnSync} = require('child_process')
const {get} = require('https')
const {dirname, join} = require('path')

const {downloads} = require('./coachlevels')

function fetch(url, target, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    // Both hosts answer with a redirect to a signed URL, and the model host
    // redirects again from there. A cap keeps a misconfigured host from
    // bouncing us around forever.
    if (redirects > 5) return reject(new Error('ถูกส่งต่อหลายทอดเกินไป'))

    let request = get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400) {
        let {location} = response.headers
        response.resume()

        if (location == null) {
          return reject(new Error(`ถูกส่งต่อโดยไม่บอกปลายทาง (${url})`))
        }

        return fetch(location, target, onProgress, redirects + 1).then(
          resolve,
          reject,
        )
      }

      if (response.statusCode !== 200) {
        response.resume()
        return reject(new Error(`ดาวน์โหลดไม่สำเร็จ (${response.statusCode})`))
      }

      let total = Number(response.headers['content-length']) || 0
      let received = 0
      // Written under a temporary name and renamed at the end, so an
      // interrupted download is never mistaken for a finished one next launch.
      let partial = `${target}.part`

      mkdirSync(dirname(target), {recursive: true})
      let file = createWriteStream(partial)

      response.on('data', (chunk) => {
        received += chunk.length
        onProgress?.({received, total})
      })

      response.pipe(file)
      response.on('error', reject)
      file.on('error', reject)
      file.on('finish', () => {
        file.close((err) => {
          if (err != null) return reject(err)

          try {
            renameSync(partial, target)
            resolve(target)
          } catch (renameError) {
            reject(renameError)
          }
        })
      })
    })

    request.on('error', reject)
  })
}

exports.fetch = fetch

/**
 * The steps that apply to the machine this is running on.
 */
exports.stepsFor = function (platform = process.platform) {
  return downloads.filter(
    (step) => step.platform == null || step.platform === platform,
  )
}

/**
 * Fetches KataGo and its networks into `directory`, skipping anything already
 * there so an interrupted run resumes at the file it stopped on.
 *
 * `onProgress` is called with the step and how far along it is: these are
 * hundreds of megabytes, and a window that just sits there looks broken.
 */
exports.downloadKataGo = async function (directory, onProgress) {
  let steps = exports.stepsFor()
  mkdirSync(directory, {recursive: true})

  for (let [index, step] of steps.entries()) {
    let target = join(directory, step.file)

    if (!existsSync(target)) {
      await fetch(step.url, target, ({received, total}) =>
        onProgress?.({
          step: index + 1,
          steps: steps.length,
          name: step.name,
          received,
          total,
        }),
      )
    }

    if (step.extract) {
      // bsdtar, which ships with Windows 10 and up and with macOS, and reads
      // zip as well as tar. Spawning it beats adding an archive dependency for
      // the one archive this app will ever open.
      let result = spawnSync('tar', ['-xf', target, '-C', directory], {
        stdio: 'ignore',
      })

      if (result.error != null || result.status !== 0) {
        throw new Error(`แตกไฟล์ ${step.name} ไม่สำเร็จ`)
      }
    }
  }

  return directory
}
