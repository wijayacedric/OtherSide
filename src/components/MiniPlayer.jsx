import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, Pause, Play, X } from 'lucide-react'

export default function MiniPlayer({
  visible,
  topic,
  voiceA,
  voiceB,
  playAll,
  flipped,
  t,
  onFlip,
  onClose,
}) {
  // During "Play whole debate" only the active stage's progress is meaningful.
  const progress = playAll?.active
    ? playAll.stage === 'A'
      ? (voiceA.progress ?? 0)
      : (voiceB.progress ?? 0)
    : Math.max(voiceA.progress ?? 0, voiceB.progress ?? 0)
  const buttonClass = (warm) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
      warm
        ? 'bg-rose-500 text-slate-950 hover:bg-rose-400'
        : 'bg-violet-500 text-slate-950 hover:bg-violet-400'
    }`

  const label = (side, playing) =>
    playing
      ? t('pauseVoice', { side }, `Pause voice ${side}`)
      : t('playVoice', { side }, `Play voice ${side}`)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.22 }}
          className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1324] shadow-[8px_8px_0_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-xs text-slate-400" title={topic}>
              <span className="font-semibold text-white">
                {t('nowDiscussing', {}, 'Now discussing')}
              </span>{' '}
              · {topic}
            </p>
            <button
              type="button"
              onClick={onFlip}
              title={t('flip', {}, 'Flip perspective')}
              aria-label={t('flip', {}, 'Flip perspective')}
              className="rounded-lg border border-violet-300/25 bg-violet-500/20 p-2 text-violet-100 transition hover:bg-violet-500/35"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('closePlayer', {}, 'Close player')}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-4 pb-3">
            <button
              type="button"
              onClick={voiceA.toggle}
              className={buttonClass(true)}
              aria-label={label('A', voiceA.isPlaying)}
              aria-pressed={voiceA.isPlaying}
            >
              {voiceA.isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              A · {t(flipped ? 'con' : 'pro', {}, flipped ? 'Con' : 'Pro')}
            </button>
            <button
              type="button"
              onClick={voiceB.toggle}
              className={buttonClass(false)}
              aria-label={label('B', voiceB.isPlaying)}
              aria-pressed={voiceB.isPlaying}
            >
              {voiceB.isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              B · {t(flipped ? 'pro' : 'con', {}, flipped ? 'Pro' : 'Con')}
            </button>
            <div className="ml-auto flex-1 sm:max-w-[14rem]">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-400 to-violet-400 transition-[width] duration-200"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

