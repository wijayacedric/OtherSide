import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSpeech } from '../lib/api'
import { pickBrowserVoice } from '../lib/browserVoices'

/**
 * Plays a short neutral sentence with the currently selected voice without
 * replacing the card's loaded debate audio. A generation token prevents an
 * older, slower request from taking over a newer preview.
 */
export function useVoicePreview({ isElevenLabs, voiceLang = 'en', onBeforePreview }) {
  const [previewing, setPreviewing] = useState(null)
  const audioRef = useRef(null)
  const urlRef = useRef(null)
  const fetchRef = useRef(null)
  const aliveRef = useRef(true)
  const tokenRef = useRef(0)
  const beforeRef = useRef(onBeforePreview)

  useEffect(() => {
    beforeRef.current = onBeforePreview
  }, [onBeforePreview])

  const cleanup = useCallback(() => {
    tokenRef.current += 1
    fetchRef.current?.abort()
    fetchRef.current = null
    if (audioRef.current) {
      const audio = audioRef.current
      audioRef.current = null
      audio.pause()
      audio.onended = null
      audio.onerror = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const preview = useCallback(
    async ({ side, text, voiceId }) => {
      if (!text) return
      cleanup()
      const token = tokenRef.current
      const current = () => aliveRef.current && tokenRef.current === token
      const done = () => {
        if (current()) setPreviewing(null)
      }
      beforeRef.current?.(side)
      setPreviewing(side)

      try {
        if (isElevenLabs) {
          const controller = new AbortController()
          fetchRef.current = controller
          const blob = await fetchSpeech({
            text,
            side,
            voiceId,
            signal: controller.signal,
          })
          if (!current()) return
          const url = URL.createObjectURL(blob)
          urlRef.current = url
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = done
          audio.onerror = done
          await audio.play()
          return
        }

        if (typeof window === 'undefined' || !window.speechSynthesis) {
          done()
          return
        }
        const chosen = pickBrowserVoice(side, voiceLang)
        const utterance = new SpeechSynthesisUtterance(text)
        if (chosen) {
          utterance.voice = chosen
          utterance.lang = chosen.lang
        }
        utterance.rate = side === 'A' ? 1.03 : 0.91
        utterance.pitch = side === 'A' ? 1.08 : 0.85
        utterance.onend = done
        utterance.onerror = done
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utterance)
      } catch {
        done()
      }
    },
    [cleanup, isElevenLabs, voiceLang],
  )

  useEffect(
    () => () => {
      aliveRef.current = false
      cleanup()
    },
    [cleanup],
  )

  return { preview, previewing }
}
