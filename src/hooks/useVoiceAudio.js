import { useCallback, useEffect, useRef, useState } from 'react'
import { fallbackClipExists, fetchSpeech } from '../lib/api'
import { pickBrowserVoice } from '../lib/browserVoices'
// speechSynthesis.cancel() is global. Each hook registers a local stop so one
// side can silence the other without leaving a stale "playing" state behind.
const activePlayers = new Map()

// Chrome can cut a single long utterance off after ~15s. Queueing short chunks
// keeps the full argument audible.
function chunkText(text) {
  const value = String(text)
  // Mandarin and Japanese do not use spaces, so split by character instead of
  // handing one enormous utterance to speechSynthesis.
  if (!/\s/.test(value)) {
    const chunks = []
    for (let index = 0; index < value.length; index += 160) {
      chunks.push(value.slice(index, index + 160))
    }
    return chunks.length ? chunks : [value]
  }

  const chunks = []
  let current = ''
  for (const word of value.split(/\s+/)) {
    const next = `${current} ${word}`.trim()
    if (next.length > 180 && current) {
      chunks.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) chunks.push(current)
  return chunks.length ? chunks : [text]
}

/**
 * Loads and plays one side's audio.
 *
 * Fallback chain: ElevenLabs -> pre-generated demo clip -> browser speech
 * synthesis -> visible text only. `source` makes the active tier visible.
 */
export function useVoiceAudio({
  side,
  text,
  allowDemoClip = false,
  clipText = null,
  ttsAvailable = true,
  voiceId = null,
  browserVoiceId = null,
  voiceLabel = 'ElevenLabs voice',
  stageVoiceName = '',
  autoPlayToken = 0,
  shouldAutoPlay = false,
  language = 'en',
  t = (key, values, fallback) => fallback ?? key,
  onComplete,
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [source, setSource] = useState('none')
  const [error, setError] = useState(null)
  const [readyToken, setReadyToken] = useState(0)
  const [voiceName, setVoiceName] = useState('')
  const [progress, setProgress] = useState(0)

  const audioRef = useRef(null)
  const objectUrlRef = useRef(null)
  const utteranceRef = useRef(null)
  const loadedTextRef = useRef(null)
  const activeUtterancesRef = useRef([])
  const activeIndexRef = useRef(0)
  const pendingPlayRef = useRef(false)
  const aliveRef = useRef(true)
  const loadSeqRef = useRef(0)
  const abortRef = useRef(null)
  const completeRef = useRef(onComplete)

  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])

  const cancelSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const clearSpeechState = useCallback(() => {
    activeUtterancesRef.current = []
    activeIndexRef.current = 0
  }, [])

  const stopPlayback = useCallback(() => {
    if (activeUtterancesRef.current.length) {
      cancelSpeech()
      clearSpeechState()
    }
    if (audioRef.current) audioRef.current.pause()
    // Browser speech has no audio element, so the old code left isPlaying true
    // after a stop. Always clear it and any queued autoplay request.
    pendingPlayRef.current = false
    setIsPlaying(false)
  }, [cancelSpeech, clearSpeechState])

  const stopOtherPlayers = useCallback(() => {
    activePlayers.forEach((stop, key) => {
      if (key !== side) stop()
    })
  }, [side])

  const clearAudioElement = useCallback(() => {
    if (audioRef.current) {
      const audio = audioRef.current
      audioRef.current = null
      audio.pause()
      audio.onplay = null
      audio.onpause = null
      audio.ontimeupdate = null
      audio.onended = null
      audio.onerror = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    activePlayers.set(side, stopPlayback)
    return () => {
      if (activePlayers.get(side) === stopPlayback) activePlayers.delete(side)
    }
  }, [side, stopPlayback])

  const attachAudio = useCallback((audio, onError) => {
    const isCurrent = () => audioRef.current === audio
    audio.onplay = () => {
      if (isCurrent() && aliveRef.current) setIsPlaying(true)
    }
    audio.onpause = () => {
      if (isCurrent() && aliveRef.current) setIsPlaying(false)
    }
    audio.ontimeupdate = () => {
      if (!isCurrent() || !aliveRef.current || !audio.duration) return
      setProgress(Math.min(1, audio.currentTime / audio.duration))
    }
    audio.onended = () => {
      if (isCurrent() && aliveRef.current) {
        setIsPlaying(false)
        setProgress(1)
        completeRef.current?.()
      }
    }
    audio.onerror = () => {
      if (!isCurrent() || !aliveRef.current) return
      clearAudioElement()
      setIsPlaying(false)
      if (onError) onError()
      else setError(t('audioFailed', {}, 'Playback failed. Tap play to try again.'))
    }
    audioRef.current = audio
  }, [clearAudioElement, t])

  const setTextFallback = useCallback(() => {
    setSource('text')
    setVoiceName(t('textOnly', {}, 'Text only'))
    setError(t('audioUnavailable', {}, 'Audio is unavailable here — the argument is still on screen.'))
  }, [t])

  const setBrowserFallback = useCallback(() => {
    // A broken audio element must never keep play() from reaching speech.
    clearAudioElement()
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setTextFallback()
      return false
    }
    const chosen = pickBrowserVoice(side, language)
    const chunks = chunkText(text)
    const browserName = chosen?.name ?? t('browserVoice', {}, 'Browser voice')
    setVoiceName(stageVoiceName ? `${stageVoiceName} · ${browserName}` : browserName)
    utteranceRef.current = () =>
      chunks.map((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        if (chosen) utterance.voice = chosen
        if (chosen?.lang) utterance.lang = chosen.lang
        // When the browser only exposes one voice for a language, a wider
        // rate/pitch gap keeps the two stage voices audibly distinct.
        utterance.rate = side === 'A' ? 1.03 : 0.91
        utterance.pitch = side === 'A' ? 1.08 : 0.85
        utterance.onstart = () => {
          if (!activeUtterancesRef.current.includes(utterance)) return
          if (aliveRef.current) {
            setIsPlaying(true)
            setProgress(index / chunks.length)
          }
        }
        // Canceled or superseded chunks still fire onend later. Only advance
        // the chunk that is actually current.
        const markEnded = () => {
          const list = activeUtterancesRef.current
          const at = list.indexOf(utterance)
          if (at === -1 || at !== activeIndexRef.current) return
          if (at + 1 < list.length) {
            activeIndexRef.current = at + 1
            setProgress((at + 1) / chunks.length)
            return
          }
          clearSpeechState()
          if (aliveRef.current) {
            setIsPlaying(false)
            setProgress(1)
            completeRef.current?.()
          }
        }
        utterance.onend = markEnded
        // A real speech error is not a completed argument. Cancellation is
        // expected when switching sides or pausing, so ignore that case.
        utterance.onerror = (event) => {
          const reason = event?.error
          if (reason === 'canceled' || reason === 'interrupted') return
          const list = activeUtterancesRef.current
          if (list.indexOf(utterance) === -1) return
          clearSpeechState()
          if (aliveRef.current) {
            setIsPlaying(false)
            setError(t('audioFailed', {}, 'Playback failed. Tap play to try again.'))
          }
        }
        return utterance
      })
    loadedTextRef.current = text
    setSource('browser')
    return true
  }, [
    browserVoiceId,
    clearAudioElement,
    clearSpeechState,
    language,
    setTextFallback,
    side,
    stageVoiceName,
    t,
    text,
  ])

  const tryClip = useCallback(async () => {
    // Clips are baked with the original stance. Never play them after a flip.
    if (!allowDemoClip || clipText !== text) return false
    try {
      if (await fallbackClipExists(side)) {
        if (!aliveRef.current) return true
        attachAudio(new Audio(`/audio/demo-side-${side.toLowerCase()}.mp3`), () => {
          setBrowserFallback()
        })
        setSource('clip')
        return true
      }
    } catch {
      // fall through to browser speech
    }
    return false
  }, [allowDemoClip, attachAudio, clipText, setBrowserFallback, side, text])

  const load = useCallback(async () => {
    if (!text || !aliveRef.current) return
    const seq = ++loadSeqRef.current

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    stopPlayback()
    clearAudioElement()
    utteranceRef.current = null
    loadedTextRef.current = null
    setIsPlaying(false)
    setProgress(0)
    setError(null)
    setSource('loading')
    setVoiceName(t('preparingAudio', {}, 'Preparing audio…'))
    setIsLoading(true)

    try {
      if (!ttsAvailable) throw new Error('ElevenLabs is not configured')
      const blob = await fetchSpeech({ text, side, voiceId, signal: controller.signal })
      if (!aliveRef.current || seq !== loadSeqRef.current) return
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      attachAudio(new Audio(url), async () => {
        if (!(await tryClip())) setBrowserFallback()
      })
      loadedTextRef.current = text
      setVoiceName(voiceLabel)
      setSource('elevenlabs')
      return
    } catch {
      if (!aliveRef.current || seq !== loadSeqRef.current) return
      if (await tryClip()) {
        loadedTextRef.current = text
        setVoiceName(t('demoClip', {}, 'Demo clip'))
        return
      }
      if (!aliveRef.current || seq !== loadSeqRef.current) return
      setBrowserFallback()
    } finally {
      if (aliveRef.current && seq === loadSeqRef.current) {
        setIsLoading(false)
        // Guarantees the autoplay effect retries even when React batches the
        // loading flags into a single render.
        setReadyToken((value) => value + 1)
      }
    }
  }, [
    attachAudio,
    clearAudioElement,
    clipText,
    setBrowserFallback,
    side,
    stopPlayback,
    t,
    text,
    tryClip,
    ttsAvailable,
    voiceId,
    voiceLabel,
  ])

  // Resolves to true only after playback is confirmed, so a blocked or
  // cancelled autoplay keeps the pending request alive for a later retry.
  // Also refuses to play audio prepared for an older version of the text.
  const play = useCallback(() => {
    if (isLoading || !text || loadedTextRef.current !== text) return false
    setError(null)

    if (audioRef.current) {
      stopOtherPlayers()
      return audioRef.current
        .play()
        .then(() => true)
        .catch(() => {
          setError(t('audioBlocked', {}, 'Your browser blocked autoplay. Tap play again.'))
          return false
        })
    }

    if (utteranceRef.current) {
      stopOtherPlayers()
      cancelSpeech()
      clearSpeechState()
      const utterances = utteranceRef.current()
      activeUtterancesRef.current = utterances
      activeIndexRef.current = 0

      return new Promise((resolve) => {
        let settled = false
        let started = false
        const finish = (ok) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          if (!ok) setError(t('audioStartFailed', {}, 'Audio was blocked. Tap play to try again.'))
          resolve(ok)
        }
        const timer = setTimeout(() => finish(false), 8000)

        const first = utterances[0]
        const onStart = first.onstart
        const onEnd = first.onend
        const onError = first.onerror
        first.onstart = (event) => {
          started = true
          onStart?.call(first, event)
          finish(true)
        }
        first.onend = (event) => {
          onEnd?.call(first, event)
          if (!started) finish(false)
        }
        first.onerror = (event) => {
          onError?.call(first, event)
          finish(false)
        }

        window.speechSynthesis.resume()
        for (const utterance of utterances) window.speechSynthesis.speak(utterance)
      })
    }

    return false
  }, [cancelSpeech, clearSpeechState, isLoading, stopOtherPlayers, t, text])

  // Keeps a play request alive until the current audio finishes loading. This
  // is what lets "Play whole debate" hand off reliably from A to B. A rejected
  // request is no longer pending, so a blocked voice cannot stall the handoff.
  const requestPlay = useCallback(() => {
    pendingPlayRef.current = true
    return Promise.resolve(play()).then(
      (started) => {
        pendingPlayRef.current = false
        return started
      },
      () => {
        pendingPlayRef.current = false
        return false
      },
    )
  }, [play])

  const pause = useCallback(() => {
    pendingPlayRef.current = false
    if (audioRef.current) audioRef.current.pause()
    if (activeUtterancesRef.current.length) {
      cancelSpeech()
      clearSpeechState()
    }
    setIsPlaying(false)
  }, [cancelSpeech, clearSpeechState])

  const toggle = useCallback(() => {
    if (isPlaying) pause()
    else requestPlay()
  }, [isPlaying, pause, requestPlay])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (shouldAutoPlay && autoPlayToken > 0) pendingPlayRef.current = true
  }, [autoPlayToken, shouldAutoPlay])

  useEffect(() => {
    if (!isLoading && source !== 'loading' && pendingPlayRef.current) {
      Promise.resolve(play()).then(
        () => {
          pendingPlayRef.current = false
        },
        () => {
          pendingPlayRef.current = false
        },
      )
    }
  }, [isLoading, play, readyToken, source])

  useEffect(() => {
    const handleVoices = () => {
      if (source === 'browser') {
        // Rebuild against the now-populated voice list without replaying.
        setBrowserFallback()
      }
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.addEventListener('voiceschanged', handleVoices)
      return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoices)
    }
  }, [setBrowserFallback, source])

  useEffect(
    () => () => {
      aliveRef.current = false
      loadSeqRef.current += 1
      if (abortRef.current) abortRef.current.abort()
      if (activeUtterancesRef.current.length) cancelSpeech()
      if (audioRef.current) audioRef.current.pause()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [cancelSpeech],
  )

  return {
    isPlaying,
    isLoading,
    source,
    error,
    voiceName,
    progress,
    toggle,
    play: requestPlay,
    pause,
  }
}
