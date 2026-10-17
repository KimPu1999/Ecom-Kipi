import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dictionarySource = fs.readFileSync(path.join(root, 'packages/i18n/src/index.tsx'), 'utf8')
const dictionaryKeys = new Set([...dictionarySource.matchAll(/^  '((?:[^'\\]|\\.)+)':/gm)].map((match) => match[1]))
const sourceRoots = ['apps/web/src', 'apps/admin/src', 'apps/seller/src']
const files = []

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(filename)
    else if (/\.(tsx|ts)$/.test(filename) && !filename.endsWith('.test.ts') && !filename.endsWith('.test.tsx')) files.push(filename)
  }
}

for (const sourceRoot of sourceRoots) walk(path.join(root, sourceRoot))

const missing = new Map()
for (const filename of files) {
  const source = fs.readFileSync(filename, 'utf8')
  for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) {
    const key = match[1]
    if (!dictionaryKeys.has(key)) {
      if (!missing.has(key)) missing.set(key, [])
      missing.get(key).push(path.relative(root, filename))
    }
  }
}

if (missing.size) {
  for (const [key, locations] of missing) console.error(`${key} — ${locations.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`i18n audit passed: ${dictionaryKeys.size} Burmese keys, no missing t() keys.`)
}
