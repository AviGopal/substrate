// Install acceptance runs after Build & publish and judges the commit the image was built from, running scripts from that
// commit's checkout (the glue tests among them). A push that changes only such a script must publish, or what it changed
// is judged only at the next unrelated build: every script install acceptance runs from its checkout lies under one of
// the build's push paths. And no wider: a push path under validation/ covers only a directory such a script lies in, since
// every other file there (reports, findings) is read by no acceptance step and a build for it judges nothing new.
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// the build's push paths: the list under on.push.paths
const pushPaths = (yml: string): string[] => {
  const block = yml.slice(yml.indexOf('\n  push:\n'))
  const at = block.indexOf('\n    paths:\n')
  if (at < 0) return []
  const out: string[] = []
  for (const line of block.slice(at + '\n    paths:\n'.length).split('\n')) {
    const m = line.match(/^ {6}- '([^']+)'$/)
    if (!m) break
    out.push(m[1])
  }
  return out
}
const covers = (glob: string, path: string) => glob.endsWith('/**') ? path.startsWith(glob.slice(0, -2)) : glob === path
// the scripts a step runs from the checkout: `bash <path>`
const runScripts = (yml: string) => [...new Set([...yml.matchAll(/\bbash ((?:validation|scripts)\/[\w./-]+\.sh)\b/g)].map((m) => m[1]))]
// the directories those scripts lie in, and the push paths under validation/ that reach past every one of them
const dirsOf = (scripts: string[]) => scripts.map((s) => s.slice(0, s.lastIndexOf('/') + 1))
const tooWide = (paths: string[], dirs: string[]) => paths.filter((g) => g.startsWith('validation/') && !dirs.some((d) => g.startsWith(d)))

test('[MUST-FAIL] every script install acceptance runs from its checkout is under a push path of the build', () => {
  const paths = pushPaths(read('.github/workflows/build-substrate-image.yml'))
  const scripts = runScripts(read('.github/workflows/install-acceptance.yml'))
  expect(scripts).toContain('validation/scripts/run-glue-tests.sh')
  expect(scripts.filter((s) => !paths.some((g) => covers(g, s)))).toEqual([])
})

test('a push path under validation/ is no wider than the directory of a script install acceptance runs (a guard)', () => {
  const paths = pushPaths(read('.github/workflows/build-substrate-image.yml'))
  expect(tooWide(paths, dirsOf(runScripts(read('.github/workflows/install-acceptance.yml'))))).toEqual([])
})

test('the reading of the push paths and of the scripts run (a guard)', () => {
  // another trigger's paths, before and after, are not the build's
  const yml = "on:\n  pull_request:\n    paths:\n      - 'pr/**'\n  push:\n    branches: [dev]\n    paths:\n      - 'a/**'\n      - 'README.md'\n  workflow_call:\n    paths:\n      - 'later/**'\n"
  expect(pushPaths(yml)).toEqual(['a/**', 'README.md'])
  expect(dirsOf(['validation/scripts/run.sh', 'scripts/substrate/acceptance/a.sh'])).toEqual(['validation/scripts/', 'scripts/substrate/acceptance/'])
  expect(tooWide(['validation/**', 'validation/scripts/**', 'validation/scripts/gate/**', 'validation/reports/**', 'scripts/substrate/**'], ['validation/scripts/']))
    .toEqual(['validation/**', 'validation/reports/**'])
  expect([covers('a/**', 'a/b/c.sh'), covers('a/**', 'ab/c.sh'), covers('README.md', 'README.md'), covers('README.md', 'x/README.md')]).toEqual([true, false, true, false])
  expect(runScripts('run: bash scripts/x/y.sh "$A"\n  mapfile -t n < <(bash validation/scripts/z.sh --print)\n  bash other/w.sh')).toEqual(['scripts/x/y.sh', 'validation/scripts/z.sh'])
})
