import assert from 'assert'
import {readFileSync} from 'fs'
import {createRequire} from 'module'

import {translateShape} from '../src/modules/coachshapes.js'

const require = createRequire(import.meta.url)

describe('translateShape', () => {
  it('names the shapes a beginner meets first', () => {
    assert.strictEqual(translateShape('4-4 Point'), 'จุดดาว (4-4)')
    assert.strictEqual(translateShape('3-4 Point'), 'จุด 3-4')
    assert.strictEqual(translateShape('One-Point Jump'), 'กระโดดหนึ่งช่อง')
    assert.strictEqual(translateShape('Empty Triangle'), 'สามเหลี่ยมกลวง')
  })

  it('handles names carrying a typographic apostrophe', () => {
    assert.strictEqual(translateShape('Tiger’s Mouth'), 'ปากเสือ')
    assert.strictEqual(translateShape('Dog’s Head'), 'หัวสุนัข')
  })

  // Falling back to the English name keeps a gap visible and still tells the
  // reader something; silently dropping it would look like no shape matched.
  it('passes through a name it has no translation for', () => {
    assert.strictEqual(translateShape('Some New Shape'), 'Some New Shape')
  })

  it('returns null when there is no name at all', () => {
    assert.strictEqual(translateShape(null), null)
    assert.strictEqual(translateShape(undefined), null)
  })
})

// Guards against the translation table drifting away from the library it names.
// A pattern added upstream should show up as an untranslated English name in
// the panel, not as a silent omission — and this test says so out loud.
describe('shape name coverage', () => {
  it('covers every pattern the matcher can report', () => {
    let library = JSON.parse(
      readFileSync(
        require.resolve('@sabaki/boardmatcher/library/library.json'),
        'utf8',
      ),
    )

    let missing = [...new Set(library.map((pattern) => pattern.name))].filter(
      (name) => translateShape(name) === name,
    )

    assert.deepStrictEqual(
      missing,
      [],
      `ยังไม่ได้แปลชื่อรูปหมาก: ${missing.join(', ')}`,
    )
  })
})
