import { HeartHandshake, Sparkles, Users } from 'lucide-react'

const points = [
  { icon: Users, titleKey: 'whyTitle1', bodyKey: 'whyBody1' },
  { icon: HeartHandshake, titleKey: 'whyTitle2', bodyKey: 'whyBody2' },
  { icon: Sparkles, titleKey: 'whyTitle3', bodyKey: 'whyBody3' },
]

const FALLBACKS = {
  whyTitle1: 'Step into someone else’s shoes',
  whyBody1:
    'Hearing a view in a real voice makes it harder to treat people as a stereotype and easier to see the reasoning behind their position.',
  whyTitle2: 'Disagree without disrespect',
  whyBody2:
    'Strong arguments and kind disagreement can coexist. Practising both helps you make your own point without shutting someone down.',
  whyTitle3: 'Build your own view',
  whyBody3:
    'You do not have to pick a side. The goal is to notice what each side gets right, what it misses, and what you would ask next.',
}

export default function WhyThisMatters({ t }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d1324] p-6 shadow-[6px_6px_0_rgba(0,0,0,0.34)]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/25 text-violet-200">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            {t('whyMatters', {}, 'Why this matters')}
          </h2>
          <p className="text-sm text-slate-400">
            {t('whySubtitle', {}, 'A small habit with a big payoff.')}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {points.map(({ icon: Icon, titleKey, bodyKey }) => (
          <div key={titleKey} className="rounded-2xl bg-slate-950/40 p-4">
            <Icon className="h-5 w-5 text-violet-300" />
            <h3 className="mt-3 font-semibold text-white">
              {t(titleKey, {}, FALLBACKS[titleKey])}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
              {t(bodyKey, {}, FALLBACKS[bodyKey])}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
