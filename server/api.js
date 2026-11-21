import 'dotenv/config'
import { getFallbackDebate } from '../src/data/demoTopics.js'
import { isSchoolAppropriateTopic } from '../src/lib/topicSafety.js'
import {
  DEFAULT_VOICE_A,
  DEFAULT_VOICE_B,
  ELEVEN_VOICES,
  ELEVEN_VOICE_IDS,
  isElevenVoiceId,
} from '../src/data/elevenVoices.js'

const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
// The stage uses one fixed voice bank. The server only accepts these IDs and
// tries the next one if an account cannot access the first choice.
const VOICE_CANDIDATES = {
  A: ELEVEN_VOICE_IDS,
  B: ELEVEN_VOICE_IDS,
}
const VOICE_NAMES = Object.fromEntries(ELEVEN_VOICES.map((voice) => [voice.id, voice.name]))
const DEFAULT_MODEL = 'eleven_multilingual_v2'
const modelCandidates = [
  process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL,
  DEFAULT_MODEL,
  'eleven_turbo_v2_5',
].filter((value, index, list) => value && list.indexOf(value) === index)

const audioCache = new Map()
const CACHE_LIMIT = 60
const generationCache = new Map()
const GENERATION_CACHE_LIMIT = 40

// ElevenLabs rejects overlapping TTS requests for the same voice with 409
// "already_running" and caps concurrent requests at 5 on many plans. Both
// stage sides preload at once, so serialize per voice and cap global traffic.
const TTS_CONCURRENCY = 3
let activeTts = 0
const ttsWaiters = []

async function withTtsSlot(task) {
  if (activeTts >= TTS_CONCURRENCY) {
    await new Promise((resolve) => ttsWaiters.push(resolve))
  } else {
    activeTts += 1
  }
  try {
    return await task()
  } finally {
    const next = ttsWaiters.shift()
    if (next) next()
    else activeTts -= 1
  }
}

const voiceLocks = new Map()
function withVoiceLock(voiceId, task) {
  const previous = voiceLocks.get(voiceId) ?? Promise.resolve()
  let release
  const current = new Promise((resolve) => {
    release = resolve
  })
  voiceLocks.set(voiceId, current)
  return previous
    .catch(() => {})
    .then(task)
    .finally(() => {
      if (voiceLocks.get(voiceId) === current) voiceLocks.delete(voiceId)
      release()
    })
}

async function requestElevenLabsSpeech(attempt, voiceSettings, signal) {
  return withVoiceLock(attempt.voiceId, async () => {
    for (let retry = 0; retry < 2; retry += 1) {
      const controller = new AbortController()
      const onAbort = () => controller.abort()
      if (signal) {
        if (signal.aborted) controller.abort()
        else signal.addEventListener('abort', onAbort, { once: true })
      }
      try {
        const response = await fetch(
          `${ELEVENLABS_URL}/${encodeURIComponent(attempt.voiceId)}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'xi-api-key': process.env.ELEVENLABS_API_KEY,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text: attempt.text,
              model_id: attempt.modelId,
              voice_settings: voiceSettings,
            }),
          },
        )

        if (response.ok) {
          return { ok: true, audio: Buffer.from(await response.arrayBuffer()) }
        }

        const detail = (await response.text()).slice(0, 200)
        if (response.status === 409 && retry === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          continue
        }
        return { ok: false, error: `${response.status}: ${detail}` }
      } finally {
        if (signal) signal.removeEventListener('abort', onAbort)
      }
    }
    return { ok: false, error: 'voice busy' }
  })
}

function json(res, status, payload) {
  if (res.headersSent) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const RATE_WINDOW_MS = 60_000
const RATE_LIMITS = { tts: 30, generate: 20 }
const rateBuckets = new Map()

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  const raw =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : req.socket?.remoteAddress ?? 'unknown'
  return raw.trim()
}

function allowRequest(req, bucket, limit) {
  const key = `${bucket}:${clientIp(req)}`
  const now = Date.now()
  const entry = rateBuckets.get(key) ?? { start: now, count: 0 }
  if (now - entry.start > RATE_WINDOW_MS) {
    entry.start = now
    entry.count = 0
  }
  entry.count += 1
  rateBuckets.set(key, entry)
  if (rateBuckets.size > 500) rateBuckets.delete(rateBuckets.keys().next().value)
  return entry.count <= limit
}

function originAllowed(req) {
  const origin = req.headers.origin
  if (!origin) return true
  const host = req.headers.host
  try {
    const parsed = new URL(origin)
    return !host || parsed.host === host
  } catch {
    return false
  }
}

function guard(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      console.error('API handler failed:', error)
      json(res, 500, { error: 'Unexpected server error' })
    })
  }
}

function readJson(req, res) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk))
      size += chunk.length
      if (size > 100_000) {
        json(res, 413, { error: 'Request body too large' })
        reject(new Error('Request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        const parsed = raw ? JSON.parse(raw) : {}
        resolve(
          parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {},
        )
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

async function handleTts(req, res) {
  let body
  try {
    body = await readJson(req, res)
  } catch {
    json(res, 400, { error: 'Invalid JSON body' })
    return
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const side = body.side === 'B' ? 'B' : 'A'
  if (!text) {
    json(res, 400, { error: 'text is required' })
    return
  }
  if (text.length > 2000) {
    json(res, 400, { error: 'text is too long' })
    return
  }

  const rawVoice = typeof body.voiceId === 'string' ? body.voiceId.trim() : ''
  if (rawVoice && !isElevenVoiceId(rawVoice)) {
    json(res, 400, { error: 'unsupported voiceId' })
    return
  }

  if (!allowRequest(req, 'tts', RATE_LIMITS.tts)) {
    json(res, 429, { error: 'Too many speech requests. Please wait a moment.' })
    return
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    json(res, 503, {
      error: 'ELEVENLABS_API_KEY is not configured. Add it to .env and restart the dev server.',
    })
    return
  }

  const requestedVoice = rawVoice || null
  const orderedCandidates = requestedVoice
    ? [requestedVoice, ...ELEVEN_VOICE_IDS.filter((id) => id !== requestedVoice)]
    : VOICE_CANDIDATES[side]
  const voiceCandidates = [...new Set([...orderedCandidates, DEFAULT_VOICE_A, DEFAULT_VOICE_B])]
  const cacheKeyFor = (voiceId, modelId) => `${side}:${voiceId}:${modelId}:${text}`
  const originalCacheKey = cacheKeyFor(voiceCandidates[0], modelCandidates[0])

  const sendAudio = (audio, voiceId, modelId) => {
    res.statusCode = 200
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader('X-Voice-Side', side)
    res.setHeader('X-Voice-Id', voiceId)
    res.setHeader('X-Model-Id', modelId)
    res.end(audio)
  }

  const cached = audioCache.get(originalCacheKey)
  if (cached) {
    sendAudio(cached, voiceCandidates[0], modelCandidates[0])
    return
  }

  // Quality first, with a short turbo retry so one slow or inaccessible voice
  // cannot sink the live demo.
  const attempts = []
  for (const modelId of modelCandidates) {
    attempts.push({ voiceId: voiceCandidates[0], modelId, text })
  }
  for (const voiceId of voiceCandidates.slice(1)) {
    attempts.push({ voiceId, modelId: modelCandidates[modelCandidates.length - 1], text })
  }

  const deadline = Date.now() + 24000
  let lastError = ''

  for (const attempt of attempts) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break

    const cacheKey = cacheKeyFor(attempt.voiceId, attempt.modelId)
    const hit = audioCache.get(cacheKey)
    if (hit) {
      sendAudio(hit, attempt.voiceId, attempt.modelId)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(9000, remaining))
    try {
      const voiceSettings = {
        stability: side === 'A' ? 0.42 : 0.62,
        similarity_boost: 0.78,
        use_speaker_boost: true,
      }
      if (/^eleven_(v3|v4)/.test(attempt.modelId)) {
        voiceSettings.style = side === 'A' ? 0.18 : 0.12
      }

      const result = await withTtsSlot(() =>
        requestElevenLabsSpeech(attempt, voiceSettings, controller.signal),
      )
      if (!result.ok) {
        lastError = result.error
        console.error(`ElevenLabs ${attempt.voiceId}/${attempt.modelId} -> ${lastError}`)
        continue
      }

      const audio = result.audio
      if (audioCache.size >= CACHE_LIMIT) {
        audioCache.delete(audioCache.keys().next().value)
      }
      audioCache.set(cacheKey, audio)
      sendAudio(audio, attempt.voiceId, attempt.modelId)
      return
    } catch (error) {
      lastError = error.message
    } finally {
      clearTimeout(timer)
    }
  }

  console.error(`ElevenLabs request failed: ${lastError || 'no voice available'}`)
  json(res, 502, { error: 'ElevenLabs could not generate audio with the available voices.' })
}

function normalizePoints(value, fallbackLabels) {
  if (!Array.isArray(value)) return null
  const points = value
    .slice(0, 3)
    .map((item, index) => ({
      label:
        typeof item?.label === 'string' && item.label.trim()
          ? item.label.trim().slice(0, 24)
          : fallbackLabels[index],
      text: stripInlineCitations(item?.text).slice(0, 420),
    }))
    .filter((point) => point.text)
  return points.length === 3 ? points : null
}

function pointsToText(points) {
  return points.map((point) => point.text).join(' ')
}

// Web search sometimes leaks markdown citations into the prose. Those links
// would be read aloud by the stage voices, so remove them before the text
// reaches the UI or TTS while keeping the separate clickable sources list.
export function stripInlineCitations(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi, '')
    .replace(/https?:\/\/[^\s)]+/gi, '')
    .replace(/\[\s*\d+\s*\]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function sourceRank(source) {
  let host = ''
  try {
    host = new URL(source.url).hostname.toLowerCase()
  } catch {
    return 2
  }
  if (
    /(^|\.)(gov|edu|org)(\.|$)/.test(host) ||
    /(bbc|reuters|apnews|npr|un\.org|who\.int|oecd|ncbi|nih|nature|science|theguardian|nytimes)/.test(
      host,
    )
  ) {
    return 0
  }
  if (/(reddit|quora|facebook|x\.com|sivo|argumentator|thelongcouncil|debatable|contradicto)/.test(host)) {
    return 2
  }
  return 1
}

const LANGUAGE_NAMES = {
  en: 'English',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  id: 'Indonesian',
}

function extractResponseText(payload) {
  const parts = []
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue
    for (const content of item.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text)
      }
    }
  }
  return parts.join('\n').trim() || (typeof payload?.output_text === 'string' ? payload.output_text : '')
}

function extractSources(payload) {
  const seen = new Set()
  const sources = []
  const add = (entry) => {
    let url = typeof entry === 'string' ? entry : entry?.url ?? entry?.source_website_url
    if (typeof url !== 'string' || !url || seen.has(url)) return
    try {
      const parsed = new URL(url)
      parsed.searchParams.delete('utm_source')
      url = parsed.toString()
    } catch {
      return
    }
    seen.add(url)
    let host = ''
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      host = 'Source'
    }
    sources.push({
      url,
      title:
        (typeof entry === 'object' && (entry.title || entry.caption || entry.name)) || host,
    })
  }

  for (const item of payload?.output ?? []) {
    const groups = [
      item?.action?.sources,
      item?.sources,
      item?.action?.results,
      item?.results,
    ]
    for (const group of groups) {
      if (Array.isArray(group)) group.forEach(add)
    }
    if (item?.type !== 'message') continue
    for (const content of item.content ?? []) {
      if (Array.isArray(content?.annotations)) {
        content.annotations
          .filter((annotation) => annotation?.type === 'url_citation')
          .forEach(add)
      }
    }
  }
  return sources.sort((a, b) => sourceRank(a) - sourceRank(b)).slice(0, 6)
}

async function askOpenAi(topic, language = 'en') {
  const languageName = LANGUAGE_NAMES[language] ?? 'English'
  const languageInstruction =
    language === 'en'
      ? 'Write in English.'
      : `Write all description and argument text in ${languageName}.`
  const instructions =
    'You write respectful, concise debate briefs for teenagers. Use the web search results as evidence. ' +
    'Search for neutral, credible sources such as government, university, public broadcaster, established news, or reputable nonprofit sites. ' +
    'Avoid debate-team scripts, SEO blogs, forums, and content farms unless they are the only material on a viewpoint. ' +
    'Never invent statistics, dates, names, studies, or quotations. If reliable sources disagree, say so fairly. ' +
    'If the topic promotes hate, harassment, or serious harm, return ONLY {"unsafe": true}. ' +
    'Otherwise return ONLY JSON with keys "description", "common", "pro", "con", "proPoints" and "conPoints". ' +
    '"description" must be 35-60 words and neutrally explain what people disagree about and why both sides care. ' +
    '"common" must be 15-30 words naming one value or goal both sides can honestly share, or null if none is honest. ' +
    '"pro" and "con" must each be one full paragraph of 90-130 words that genuinely defends that side with concrete reasons grounded in the sources. ' +
    '"proPoints" and "conPoints" must each be arrays of exactly 3 objects with keys "label" and "text". ' +
    'Use labels Claim, Reason, Guardrail for proPoints and Claim, Problem, Alternative for conPoints. ' +
    'Each point text must be two or three plain sentences of 30-50 words. ' +
    'No insults, no padding, no invented facts, no vague generalities. ' +
    'Do not include links, URLs, markdown citations, or bracketed reference numbers in any JSON value; ' +
    'sources are collected separately. ' +
    languageInstruction
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL_ID || 'gpt-4.1-mini',
        instructions,
        input: `Opinion to research and debate: ${topic}`,
        tools: [
          {
            type: 'web_search',
            search_context_size: 'medium',
          },
        ],
        tool_choice: 'required',
        include: ['web_search_call.action.sources'],
        max_output_tokens: 1800,
        store: false,
      }),
    })
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200)
      console.error(`OpenAI responses request failed (${response.status}): ${detail}`)
      return null
    }

    const data = await response.json()
    const raw = extractResponseText(data)
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    if (parsed.unsafe === true) return { unsafe: true }

    const proPoints = normalizePoints(parsed.proPoints, ['Claim', 'Reason', 'Guardrail'])
    const conPoints = normalizePoints(parsed.conPoints, ['Claim', 'Problem', 'Alternative'])
    if (!proPoints || !conPoints) return null

    const cleanParagraph = (value) =>
      stripInlineCitations(value).replace(/\s+/g, ' ').slice(0, 1200)

    const common = stripInlineCitations(parsed.common)

    return {
      description: cleanParagraph(parsed.description).slice(0, 500),
      common: common ? common.slice(0, 300) : null,
      proPoints,
      conPoints,
      pro: cleanParagraph(parsed.pro) || pointsToText(proPoints),
      con: cleanParagraph(parsed.con) || pointsToText(conPoints),
      sources: extractSources(data),
      source: 'llm',
    }
  } catch (error) {
    console.error(`OpenAI generation failed: ${error.message}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function handleGenerate(req, res) {
  let body
  try {
    body = await readJson(req, res)
  } catch {
    json(res, 400, { error: 'Invalid JSON body' })
    return
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 300) : ''
  if (!topic) {
    json(res, 400, { error: 'topic is required' })
    return
  }
  if (!isSchoolAppropriateTopic(topic)) {
    json(res, 400, { error: 'unsafe_topic' })
    return
  }
  if (!allowRequest(req, 'generate', RATE_LIMITS.generate)) {
    json(res, 429, { error: 'Too many debates. Please wait a moment.' })
    return
  }
  const language =
    typeof body.language === 'string' &&
    Object.prototype.hasOwnProperty.call(LANGUAGE_NAMES, body.language)
      ? body.language
      : 'en'

  const cacheKey = `${language}:${topic.toLowerCase().replace(/\s+/g, ' ')}`
  const cached = generationCache.get(cacheKey)
  if (cached) {
    json(res, 200, { topic, language, ...cached })
    return
  }

  let result = null
  if (process.env.OPENAI_API_KEY) {
    result = await askOpenAi(topic, language)
  }
  if (result?.unsafe) {
    json(res, 400, { error: 'unsafe_topic' })
    return
  }
  if (!result) result = getFallbackDebate(topic)
  if (typeof result.description !== 'string' || !result.description.trim()) {
    result.description = getFallbackDebate(topic).description
  }
  if (result.source === 'llm') {
    if (generationCache.size >= GENERATION_CACHE_LIMIT) {
      generationCache.delete(generationCache.keys().next().value)
    }
    generationCache.set(cacheKey, result)
  }

  json(res, 200, { topic, language, ...result })
}

async function handleVoices(_req, res) {
  json(res, 200, {
    voices: ELEVEN_VOICES.map((voice) => ({
      id: voice.id,
      name: voice.name,
      detail: voice.detail,
      url: voice.url,
    })),
  })
}

async function handleHealth(_req, res) {
  let elevenlabs = false
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (apiKey) {
    // Presence of a key is not proof it works. A cheap validation call keeps
    // the demo badge honest when a key is expired or copied incorrectly.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    try {
      // Use the voices endpoint instead of /user: a restricted key only needs
      // Voices: Read for this check, which is less privilege than reading the
      // full user profile.
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey },
        signal: controller.signal,
      })
      elevenlabs = response.ok
      if (!response.ok) console.error(`ElevenLabs key check failed (${response.status})`)
    } catch {
      elevenlabs = false
    } finally {
      clearTimeout(timer)
    }
  }

  const voiceA = DEFAULT_VOICE_A
  const voiceB = DEFAULT_VOICE_B
  const nameFor = (id) => VOICE_NAMES[id] ?? 'Voice'

  json(res, 200, {
    ok: true,
    elevenlabs,
    llm: Boolean(process.env.OPENAI_API_KEY),
    model: modelCandidates[0],
    recommended: { A: DEFAULT_VOICE_A, B: DEFAULT_VOICE_B },
    voices: {
      A: { id: voiceA, name: nameFor(voiceA) },
      B: { id: voiceB, name: nameFor(voiceB) },
    },
  })
}

export function apiMiddleware() {
  return (req, res, next) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    const isApi = path.startsWith('/api/')

    if (isApi && req.method === 'POST' && !originAllowed(req)) {
      json(res, 403, { error: 'Cross-origin API requests are not allowed' })
      return
    }

    if (req.method === 'GET' && path === '/api/health') {
      guard(handleHealth)(req, res)
      return
    }
    if (req.method === 'GET' && path === '/api/voices') {
      guard(handleVoices)(req, res)
      return
    }
    if (req.method === 'POST' && path === '/api/tts') {
      guard(handleTts)(req, res)
      return
    }
    if (req.method === 'POST' && path === '/api/generate') {
      guard(handleGenerate)(req, res)
      return
    }
    next()
  }
}
