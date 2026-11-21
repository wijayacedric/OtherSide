import { getFallbackDebate } from '../data/demoTopics.js'

export async function generateDebate(topic, language = 'en') {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, language }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      detail = (await response.json()).error ?? ''
    } catch {
      // ignore
    }
    throw new Error(detail || `Request failed (${response.status})`)
  }

  // A plain static host serves index.html for unknown routes. Use the bundled
  // fallback instead of throwing a raw JSON parse error on stage.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return { topic, ...getFallbackDebate(topic) }
  }
  return response.json()
}

export async function fetchSpeech({ text, side, voiceId, signal }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 28000)
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, side, voiceId }),
      signal: controller.signal,
    })

    if (!response.ok) {
      let detail = ''
      try {
        detail = (await response.json()).error ?? ''
      } catch {
        // ignore
      }
      throw new Error(detail || `Speech request failed (${response.status})`)
    }

    // A 200 HTML fallback from a static host is not speech. Reject it so the
    // clip -> browser -> visible argument chain can still run.
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('audio/')) {
      throw new Error(`Unexpected speech response (${contentType || 'unknown'})`)
    }
    return await response.blob()
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

export async function fallbackClipExists(side) {
  try {
    const response = await fetch(`/audio/demo-side-${side.toLowerCase()}.mp3`, {
      method: 'HEAD',
    })
    // A static host's SPA fallback answers 200 with index.html for a missing
    // .mp3. Only a real audio response is a usable clip.
    const contentType = response.headers.get('content-type') ?? ''
    return (
      response.ok &&
      contentType.startsWith('audio/') &&
      Number(response.headers.get('content-length') ?? 0) > 0
    )
  } catch {
    return false
  }
}
