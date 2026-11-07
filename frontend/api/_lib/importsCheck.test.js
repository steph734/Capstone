// Guards against the bug that silently broke the patient's home practice and today's games lists:
// a route called a shared helper (pickPatientByEmail) but never imported it, so every request crashed with
// "ReferenceError: ... is not defined" and the screen just showed "nothing here".
//
// For every file under api/, any call to a helper that another api module EXPORTS must be imported (or defined) in that file.
// (run with:  npx vitest run api/_lib/importsCheck.test.js)
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(dir, e.name))) : [path.join(dir, e.name)]))
const files = walk(ROOT).filter((f) => f.endsWith('.js') && !/\.test\./.test(f))
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1').replace(/`(?:\\.|[^`\\])*`/g, '``').replace(/'(?:\\.|[^'\\\n])*'/g, "''").replace(/"(?:\\.|[^"\\\n])*"/g, '""')

// Every named function/const that some api module exports.
const exported = new Map()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let)\s+([A-Za-z_$][\w$]*)/g)) exported.set(m[1], f)
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach((n) => exported.set(n, f))
}
const SKIP = new Set(['handler', 'default', 'req', 'res', 'method', 'fail', 'str', 'oid']) // very common local names

describe('every api file imports the shared helpers it calls', () => {
  it('finds no call to an exported helper that is neither imported nor defined', () => {
    const problems = []
    for (const f of files) {
      const raw = fs.readFileSync(f, 'utf8')
      const code = strip(raw)
      for (const [name, from] of exported) {
        if (SKIP.has(name) || from === f) continue
        if (!new RegExp(`(?<![.\\w$])${name.replace(/\$/g, '\\$')}\\s*\\(`).test(code)) continue // not called here
        const defined = new RegExp(`(?:import[^;]*?[{,\\s]${name}[\\s,}][^;]*?from|function\\s*\\*?\\s*${name}\\b|(?:const|let|var)\\s+${name}\\b|import\\s+${name}\\s+from|\\b${name}\\s*[,}]\\s*=|[(,]\\s*${name}\\s*[,)]\\s*=>|\\b${name}\\s*=>)`).test(raw)
        const paramOrLocal = new RegExp(`(?:function[^(]*\\([^)]*\\b${name}\\b|\\(\\s*[^)]*\\b${name}\\b[^)]*\\)\\s*=>|\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=)`).test(raw) // used as a parameter / destructured local
        if (!defined && !paramOrLocal) problems.push(`${path.relative(ROOT, f)} calls ${name}() (exported by ${path.relative(ROOT, from)}) but does not import it`)
      }
    }
    expect(problems).toEqual([])
  })
})
