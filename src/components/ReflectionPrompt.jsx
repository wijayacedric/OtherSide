import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircleQuestion } from 'lucide-react'

const CHOICES = [
  { id: 'a', labelKey: 'reflectionA', fallback: "Voice A's point" },
  { id: 'b', labelKey: 'reflectionB', fallback: "Voice B's point" },
  { id: 'neither', labelKey: 'reflectionNeither', fallback: 'Neither — I have a new question' },
]

export default function ReflectionPrompt({ visible, choice, saved, onChoose, t }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="rounded-3xl border border-violet-300/20 bg-[#0d1324] p-5 shadow-[6px_6px_0_rgba(0,0,0,0.34)]"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
              <MessageCircleQuestion className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                {t('reflectionTitle', {}, 'After flipping')}
              </h3>
              <p className="text-sm text-slate-400">
                {t('reflectionQuestion', {}, 'Which point would you ask about?')}
              </p>
            </div>
            {saved && (
              <span className="ml-auto text-xs text-emerald-300">
                {t('reflectionSaved', {}, 'Saved privately on this device.')}
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {CHOICES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChoose(item.id)}
                aria-pressed={choice === item.id}
                className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                  choice === item.id
                    ? 'border-violet-300/40 bg-violet-400/20 text-white'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {t(item.labelKey, {}, item.fallback)}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
