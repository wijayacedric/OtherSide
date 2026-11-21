import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'

const { apiMiddleware, stripInlineCitations } = await import('../server/api.js')

// server/api.js loads dotenv on import, so clear keys afterwards to keep the
// API in demo mode regardless of a developer's .env file.
process.env.ELEVENLABS_API_KEY = ''
process.env.OPENAI_API_KEY = ''

let server
let base

function post(path, body, headers = {}) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

async function json(response) {
  return response.json()
}

before(async () => {
  const middleware = apiMiddleware()
  server = createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404
      res.end('not found')
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
})

test('malformed JSON bodies are rejected without crashing the server', async () => {
  for (const body of ['null', '[]', '"x"', '{broken']) {
    const response = await post('/api/generate', body)
    assert.equal(response.status, 400, `body ${body}`)
    const payload = await json(response)
    assert.equal(typeof payload.error, 'string')
  }
  const health = await fetch(`${base}/api/health`)
  assert.equal(health.status, 200)
})

test('curated topics still generate a debate', async () => {
  const response = await post(
    '/api/generate',
    JSON.stringify({ topic: 'School uniforms should be mandatory.', language: 'en' }),
  )
  assert.equal(response.status, 200)
  const payload = await json(response)
  assert.equal(payload.source, 'curated')
  assert.ok(payload.pro.length > 100)
  assert.ok(payload.con.length > 100)
})

test('unsafe topics are refused', async () => {
  const response = await post('/api/generate', JSON.stringify({ topic: 'How to hurt someone' }))
  assert.equal(response.status, 400)
  assert.equal((await json(response)).error, 'unsafe_topic')
})

test('oversized bodies return a structured 413', async () => {
  const response = await post('/api/generate', JSON.stringify({ topic: 'a'.repeat(120_000) }))
  assert.equal(response.status, 413)
  assert.equal((await json(response)).error, 'Request body too large')
})

test('tts validates input before reporting a missing key', async () => {
  const badVoice = await post('/api/tts', JSON.stringify({ text: 'Hello', voiceId: 'nope' }))
  assert.equal(badVoice.status, 400)

  const longText = await post('/api/tts', JSON.stringify({ text: 'a'.repeat(2001) }))
  assert.equal(longText.status, 400)

  const noKey = await post('/api/tts', JSON.stringify({ text: 'Hello' }))
  assert.equal(noKey.status, 503)
})

test('voices endpoint exposes exactly the seven stage voices', async () => {
  const response = await fetch(`${base}/api/voices`)
  assert.equal(response.status, 200)
  const payload = await json(response)
  assert.equal(payload.voices.length, 7)
  assert.ok(payload.voices.some((voice) => voice.id === 'B9U4Lk9uR0DBeFxDocVd'))
})

test('inline citations are stripped from spoken argument text', () => {
  const raw =
    'Cities save money ([city.gov](https://city.gov/plan?utm_source=openai)). Air improves [1]. See https://example.org/study'
  assert.equal(
    stripInlineCitations(raw),
    'Cities save money. Air improves. See',
  )
})
