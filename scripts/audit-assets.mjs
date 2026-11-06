import { readFile, readdir, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  }))).flat()
}

const sources = (await walk(path.join(root, 'src'))).filter(file => /\.(tsx?|css)$/.test(file))
sources.push(path.join(root, 'index.html'))
const content = (await Promise.all(sources.map(file => readFile(file, 'utf8')))).join('\n')
const referenced = new Set([...content.matchAll(/["'`(](\/(?:images\/[^"'`()\s]+|fitmate\.svg))/g)].map(match => match[1]))
const publicFiles = (await walk(path.join(root, 'public'))).map(file => '/' + path.relative(path.join(root, 'public'), file).replaceAll('\\', '/'))
const missing = []
for (const asset of referenced) {
  try { await access(path.join(root, 'public', asset)) }
  catch { missing.push(asset) }
}
const unused = publicFiles.filter(file => !referenced.has(file))
if (missing.length || unused.length) {
  if (missing.length) console.error('Referenced assets are missing:', missing)
  if (unused.length) console.error('Public files have no application reference:', unused)
  process.exitCode = 1
} else {
  console.log(`All ${publicFiles.length} public assets exist and are referenced by the application.`)
}
