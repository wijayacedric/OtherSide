import { Languages } from 'lucide-react'

export default function LanguageSelect({ languages, value, onChange, label, compact = false }) {
  return (
    <label
      className={`flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 ${
        compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
      }`}
    >
      <Languages className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className={`min-w-0 cursor-pointer appearance-none bg-transparent text-current outline-none ${
          compact ? 'max-w-[9rem]' : 'max-w-[12rem]'
        }`}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code} className="bg-slate-900 text-white">
            {language.label}
          </option>
        ))}
      </select>
    </label>
  )
}
