import { motion } from 'framer-motion'
import { Loader2, Pause, Play, Volume2 } from 'lucide-react'
import Waveform from './Waveform.jsx'

const SOURCE_KEYS = {
  elevenlabs: 'elevenlabsVoice',
  clip: 'demoClip',
  browser: 'browserVoice',
  text: 'textOnly',
  loading: 'preparingAudio',
  none: 'audioNotReady',
}

const FALLBACKS = {
  elevenlabsVoice: 'ElevenLabs voice',
  demoClip: 'Demo clip',
  browserVoice: 'Browser voice',
  textOnly: 'Text only',
  preparingAudio: 'Preparing audio…',
  audioNotReady: 'Audio not ready',
}

export default function VoiceCard({
  side,
  stance,
  voiceName,
  text,
  player,
  delay,
  voiceOptions,
  selectedVoice,
  onVoiceChange,
  onPreview,
  previewing,
  previewLabel,
  voiceNote,
  t,
}) {
  const warm = side === 'A'
  const gradient = warm
    ? 'from-rose-500/25 via-fuchsia-400/10 to-transparent'
    : 'from-violet-500/25 via-blue-500/10 to-transparent'
  const badge = warm
    ? 'border-rose-300/30 bg-rose-400/15 text-rose-200'
    : 'border-violet-300/30 bg-violet-400/15 text-violet-200'
  const avatar = warm
    ? 'from-rose-400 to-pink-400 shadow-rose-500/40'
    : 'from-violet-400 to-indigo-500 shadow-violet-500/40'
  const button = warm
    ? 'bg-rose-500 hover:bg-rose-400 text-slate-950'
    : 'bg-violet-500 hover:bg-violet-400 text-slate-950'
  const key = SOURCE_KEYS[player.source] ?? 'audioNotReady'
  const sourceText = t(key, {}, FALLBACKS[key] ?? player.source)
  const previewText = previewLabel ?? t('previewVoice', {}, 'Preview voice')

  return (
    <motion.section
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={`voice-panel relative overflow-hidden rounded-[1.75rem] border border-white/10 border-l-2 ${warm ? 'border-l-rose-400/60' : 'border-l-violet-400/60'} bg-[#0d1324] p-6 sm:p-7`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatar} font-display text-2xl font-bold shadow-lg`}
          >
            {side}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest ${badge}`}
              >
                {stance}
              </span>
              <span className="text-xs text-slate-400">
                {t('voice', {}, 'Voice')} {side}
              </span>
            </div>
            <h3 className="mt-1 max-w-[16rem] break-words font-display text-xl font-semibold text-white [overflow-wrap:anywhere]">
              {voiceName}
            </h3>
          </div>
        </div>
        <span
          role="status"
          aria-live="polite"
          className="max-w-[8rem] text-right text-[10px] text-slate-400 sm:max-w-none sm:text-xs"
        >
          {sourceText}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t('voice', {}, 'Voice')}
          </span>
          <div
            role="group"
            aria-label={t('chooseVoice', { side }, `Choose voice for side ${side}`)}
            className="flex flex-wrap gap-1.5"
          >
            {voiceOptions.map((option) => {
              const active = option.id === selectedVoice
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onVoiceChange(option.id)}
                  aria-pressed={active}
                  aria-label={`${option.label} · ${t('voice', {}, 'Voice')} ${side}`}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? warm
                        ? 'border-rose-300/50 bg-rose-400/20 text-rose-100'
                        : 'border-violet-300/50 bg-violet-400/20 text-violet-100'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => onPreview()}
            disabled={!text || previewing === side}
            aria-label={previewText}
            title={previewText}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              warm
                ? 'border-rose-300/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20'
                : 'border-violet-300/25 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20'
            }`}
          >
            <Volume2 className="h-3.5 w-3.5" />
            {previewing === side ? t('previewingVoice', {}, 'Playing preview…') : previewText}
          </button>
        </div>
        {voiceNote && <p className="mt-2 text-[11px] leading-4 text-fuchsia-200/70">{voiceNote}</p>}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={player.toggle}
          disabled={player.isLoading || !text || player.source === 'text'}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${button} shadow-lg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label={
            player.isPlaying
              ? t('pauseVoice', { side }, `Pause voice ${side}`)
              : t('playVoice', { side }, `Play voice ${side}`)
          }
          aria-pressed={player.isPlaying}
        >
          {player.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : player.isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          )}
        </button>
        <div className={`min-w-0 flex-1 ${warm ? 'text-rose-200' : 'text-violet-200'}`}>
          <Waveform playing={player.isPlaying} progress={player.progress ?? 0} />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/5 bg-slate-950/40 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <p
            className={`font-mono text-[10px] font-semibold uppercase tracking-[0.22em] ${
              warm ? 'text-rose-300' : 'text-violet-300'
            }`}
          >
            {t('theArgument', {}, 'The argument')}
          </p>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <p className="mx-auto mt-3 max-w-3xl text-[17px] leading-[1.9] text-slate-100 sm:text-[18px]">
          {text}
        </p>
      </div>

      {player.error && (
        <p role="status" aria-live="polite" className="mt-3 text-xs text-fuchsia-300/90">
          {player.error}
        </p>
      )}
    </motion.section>
  )
}

