import { Bookmark, Download, Trash2 } from 'lucide-react'

const LOCALES = {
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  zh: 'zh-CN',
  ja: 'ja-JP',
  id: 'id-ID',
}

export default function SavedDebates({
  items,
  onLoad,
  onDelete,
  onClearAll,
  onExport,
  language = 'en',
  t,
}) {
  const sourceLabel = (item) => {
    const source = String(item.source ?? 'curated')
    const key = `source${source.charAt(0).toUpperCase()}${source.slice(1)}`
    return t(key, {}, source)
  }

  const clearAll = () => {
    if (window.confirm(t('clearAllConfirm', {}, 'Delete all saved debates?'))) onClearAll()
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0d1324] p-6 shadow-[6px_6px_0_rgba(0,0,0,0.34)]">
      <div className="flex flex-wrap items-center gap-3">
        <Bookmark className="h-5 w-5 text-fuchsia-300" />
        <h2 className="font-display text-lg font-semibold text-white">
          {t('savedDebates', {}, 'Saved debates')}
        </h2>
        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-slate-400">
          {items.length}
        </span>
        {items.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" />
              {t('exportDebates', {}, 'Export JSON')}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg border border-rose-300/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
            >
              {t('clearAll', {}, 'Delete all')}
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{t('noSaved', {}, 'No saved debates yet.')}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white" title={item.topic}>
                  {item.topic}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleString(LOCALES[language] ?? 'en-US')} ·{' '}
                  {sourceLabel(item)}
                  {item.language ? ` · ${String(item.language).toUpperCase()}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onLoad(item)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                {t('load', {}, 'Load')}
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                aria-label={`${t('delete', {}, 'Delete')}: ${item.topic}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

