import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { DEFAULT_TOPIC, getFallbackDebate } from '../src/data/demoTopics.js'
import { DEFAULT_VOICE_A, DEFAULT_VOICE_B } from '../src/data/elevenVoices.js'

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = resolve(here, '../public/audio')

const apiKey = process.env.ELEVENLABS_API_KEY
if (!apiKey) {
  console.error('Set ELEVENLABS_API_KEY in .env before running npm run prepare:audio')
  process.exit(1)
}

const debate = getFallbackDebate(DEFAULT_TOPIC)
const clips = [
  {
    side: 'A',
    text: debate.pro,
    voice: DEFAULT_VOICE_A,
    file: 'demo-side-a.mp3',
  },
  {
    side: 'B',
    text: debate.con,
    voice: DEFAULT_VOICE_B,
    file: 'demo-side-b.mp3',
  },
]

await mkdir(outputDir, { recursive: true })
const model = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'

for (const clip of clips) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${clip.voice}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: clip.text,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  )

  if (!response.ok) {
    console.error(`Side ${clip.side} failed: ${response.status} ${await response.text()}`)
    process.exit(1)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  await writeFile(resolve(outputDir, clip.file), bytes)
  console.log(`Wrote ${clip.file} (${bytes.length} bytes)`)
}

console.log('Fallback clips ready. The demo now works even when the API is slow or offline.')
