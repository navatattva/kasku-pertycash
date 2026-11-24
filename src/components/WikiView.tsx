import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  LayoutGrid,
  ListChecks,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  WIKI_ARTICLES,
  WIKI_CATEGORIES,
  type OptionalModuleKey,
  type WikiArticle,
  type WikiCategoryId,
} from '../data/wikiArticles.ts';
import type { NavTab } from './Sidebar.tsx';

interface WikiViewProps {
  moduleStatus: Record<OptionalModuleKey, boolean>;
  onNavigateTab: (tab: NavTab) => void;
}

type CategoryFilter = 'all' | WikiCategoryId;
type WikiLayoutMode = 'reader' | 'grid';

export function WikiView({ moduleStatus, onNavigateTab }: WikiViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(WIKI_ARTICLES[0].id);
  const [layoutMode, setLayoutMode] = useState<WikiLayoutMode>('reader');

  const filteredArticles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return WIKI_ARTICLES.filter((article) => {
      if (categoryFilter !== 'all' && article.category !== categoryFilter) {
        return false;
      }
      if (query) {
        const haystack = [
          article.title,
          article.shortTitle,
          article.categoryLabel,
          article.summary,
          ...article.keyCapabilities,
          ...article.workflowSteps,
          ...article.rulesAndGuards,
          ...article.keywords,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      }
      return true;
    });
  }, [categoryFilter, search]);

  const activeArticle: WikiArticle | undefined = useMemo(() => {
    if (filteredArticles.length === 0) return undefined;
    return (
      filteredArticles.find((a) => a.id === selectedId) ?? filteredArticles[0]
    );
  }, [filteredArticles, selectedId]);

  const activeIndex = activeArticle
    ? filteredArticles.findIndex((a) => a.id === activeArticle.id)
    : -1;
  const prevArticle =
    activeIndex > 0 ? filteredArticles[activeIndex - 1] : undefined;
  const nextArticle =
    activeIndex >= 0 && activeIndex < filteredArticles.length - 1
      ? filteredArticles[activeIndex + 1]
      : undefined;

  function renderArticleAccessAction(article: WikiArticle) {
    const isOptional = Boolean(article.optionalModuleKey);
    const isEnabled = article.optionalModuleKey
      ? moduleStatus[article.optionalModuleKey]
      : true;

    if (isOptional && !isEnabled) {
      return (
        <button
          type="button"
          onClick={() => onNavigateTab('modules')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 whitespace-nowrap"
        >
          <span>Aktifkan di Pusat Modul</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onNavigateTab(article.targetTab)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
      >
        <span>Buka Fitur Ini</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wiki Header & Search */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-700 shrink-0" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Wiki &amp; Panduan Lengkap Seluruh Fitur KasKu Kargo
              </h2>
            </div>
            <p className="text-xs text-slate-600 max-w-3xl">
              Dokumentasi resmi alur kerja operasional kas kecil, kontrol
              keuangan, audit anti-tampering, serta seluruh modul opsional yang
              tersedia di sistem.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              data-testid="wiki-article-count"
              className="font-mono tabular-nums text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-2 rounded-lg"
            >
              {filteredArticles.length}/{WIKI_ARTICLES.length} Panduan
            </span>
            <button
              type="button"
              onClick={() =>
                setLayoutMode(layoutMode === 'reader' ? 'grid' : 'reader')
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>
                {layoutMode === 'reader'
                  ? `Lihat Semua (${filteredArticles.length})`
                  : 'Mode Baca Detail'}
              </span>
            </button>
          </div>
        </div>

        {/* Category Filter & Search */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter kategori wiki"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                categoryFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Kategori
            </button>
            {WIKI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={categoryFilter === cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  categoryFilter === cat.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 lg:max-w-xs">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari fitur, istilah, aturan..."
              aria-label="Cari panduan wiki"
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>
        </div>
      </section>

      {filteredArticles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-12 px-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Tidak ada artikel wiki yang cocok dengan pencarian “{search}”
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Coba kata kunci lain seperti “kasbon”, “opname”, “sha-256”, atau
            “pajak”.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategoryFilter('all');
            }}
            className="mt-4 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            Reset Pencarian
          </button>
        </div>
      ) : layoutMode === 'grid' ? (
        /* Grid Index of All Matching Features */
        <section
          aria-label="Daftar Kartu Panduan Fitur"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {filteredArticles.map((article) => {
            const isOptional = Boolean(article.optionalModuleKey);
            const isEnabled = article.optionalModuleKey
              ? moduleStatus[article.optionalModuleKey]
              : true;

            return (
              <article
                key={article.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-emerald-700/40 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono font-semibold text-slate-400">
                      #{article.order} · {article.categoryLabel}
                    </span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-md ${
                        !isOptional
                          ? 'bg-slate-100 text-slate-700'
                          : isEnabled
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {!isOptional
                        ? 'Fitur Inti'
                        : isEnabled
                        ? 'Modul Aktif'
                        : 'Modul Nonaktif'}
                    </span>
                  </div>

                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    {article.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {article.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(article.id);
                      setLayoutMode('reader');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <span>Baca Panduan Lengkap</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono text-[11px] text-slate-400">
                    {article.workflowSteps.length} langkah
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        /* Reader Layout: TOC Sidebar + Focused Deep-Dive Article */
        <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] gap-6 items-start">
          <aside
            aria-label="Daftar Isi Wiki"
            className="bg-white border border-slate-200 rounded-xl p-3 space-y-4 lg:sticky lg:top-20"
          >
            <div className="px-2 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Daftar Isi Fitur
              </p>
            </div>

            <div className="space-y-3">
              {WIKI_CATEGORIES.map((cat) => {
                const items = filteredArticles.filter(
                  (a) => a.category === cat.id
                );
                if (items.length === 0) return null;
                return (
                  <div key={cat.id} className="space-y-1">
                    <p className="px-2 text-[11px] font-semibold text-slate-500">
                      {cat.label}
                    </p>
                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const selected = activeArticle?.id === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedId(item.id)}
                            aria-current={selected ? 'true' : undefined}
                            className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                              selected
                                ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                            }`}
                          >
                            <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                              {item.order}
                            </span>
                            <span className="truncate">{item.shortTitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {activeArticle && (
            <article
              data-testid={`wiki-article-${activeArticle.id}`}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
            >
              {/* Article Header */}
              <div className="pb-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-slate-500">
                      Panduan #{activeArticle.order}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-medium text-slate-600">
                      {activeArticle.categoryLabel}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    {activeArticle.optionalModuleKey ? (
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-md ${
                          moduleStatus[activeArticle.optionalModuleKey]
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {moduleStatus[activeArticle.optionalModuleKey]
                          ? 'Modul Opsional · Aktif'
                          : 'Modul Opsional · Nonaktif'}
                      </span>
                    ) : (
                      <span className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        Fitur Inti
                      </span>
                    )}
                  </div>

                  <h3 className="font-display text-xl font-bold text-slate-900">
                    {activeArticle.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {activeArticle.summary}
                  </p>
                </div>

                <div className="shrink-0">
                  {renderArticleAccessAction(activeArticle)}
                </div>
              </div>

              {/* Key Capabilities */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-emerald-700 shrink-0" />
                  <h4 className="font-display text-sm font-semibold text-slate-900">
                    Kemampuan &amp; Fungsi Utama
                  </h4>
                </div>
                <ul className="space-y-2">
                  {activeArticle.keyCapabilities.map((cap, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                      <span>{cap}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Step-by-step Workflow */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-emerald-700 shrink-0" />
                  <h4 className="font-display text-sm font-semibold text-slate-900">
                    Alur Penggunaan (Langkah demi Langkah)
                  </h4>
                </div>
                <ol className="space-y-2.5">
                  {activeArticle.workflowSteps.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs sm:text-sm text-slate-700 leading-relaxed"
                    >
                      <span className="font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5 text-xs shrink-0">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Rules & Guards */}
              <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                  <h4 className="font-display text-sm font-semibold text-emerald-950">
                    Aturan Validasi &amp; Pengendalian Internal
                  </h4>
                </div>
                <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-emerald-900 leading-relaxed">
                  {activeArticle.rulesAndGuards.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </section>

              {/* Prev / Next Article Navigation */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                {prevArticle ? (
                  <button
                    type="button"
                    onClick={() => setSelectedId(prevArticle.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>
                      Sebelumnya: {prevArticle.order}. {prevArticle.shortTitle}
                    </span>
                  </button>
                ) : (
                  <span />
                )}

                {nextArticle && (
                  <button
                    type="button"
                    onClick={() => setSelectedId(nextArticle.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 ml-auto"
                  >
                    <span>
                      Berikutnya: {nextArticle.order}. {nextArticle.shortTitle}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
