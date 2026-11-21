import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const strings = await readFile(new URL('src/i18n/strings.js', root), 'utf8')
const englishKeys = [...strings.matchAll(/^  ([A-Za-z0-9]+):/gm)].map((match) => match[1])
const codes = ['de', 'es', 'fr', 'id', 'ja', 'zh']
let failed = false

for (const code of codes) {
  const file = new URL(`src/data/translations/${code}.json`, root)
  const data = JSON.parse(await readFile(file, 'utf8'))
  const keys = Object.keys(data.ui ?? {})
  const missing = englishKeys.filter((key) => !keys.includes(key))
  const empty = keys.filter((key) => !(data.ui[key] ?? '').trim())
  console.log(
    `${code}: ${keys.length} UI keys, ${Object.keys(data.topics ?? {}).length} topics, ${missing.length} missing, ${empty.length} empty`,
  )
  if (missing.length || empty.length) {
    failed = true
    if (missing.length) console.error(`  Missing: ${missing.join(', ')}`)
    if (empty.length) console.error(`  Empty: ${empty.join(', ')}`)
  }
}

if (failed) process.exit(1)
