"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  aggregateStrategies,
  BucketConfig,
  SerializableStrategiesConfig,
  SerializableStrategiesConfigSchema,
  SerializedCard,
  StrategyAggregation,
} from 'kindred-paths';
import { StrategiesGrid } from './strategies-grid';

/** Direct client-side fetches — bypass 'use server' double-hop overhead. */
async function fetchStrategyList(): Promise<string[]> {
  const res = await fetch('/api/strategy');
  if (!res.ok) return [];
  return res.json();
}

async function fetchStrategies(filename: string): Promise<SerializableStrategiesConfig | null> {
  const res = await fetch(`/api/strategy/${encodeURIComponent(filename.toLowerCase())}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load strategies from "${filename}"`);
  const json = await res.json();
  const parsed = SerializableStrategiesConfigSchema.safeParse(json);
  if (!parsed.success) return null;
  return parsed.data;
}

const LS_KEY = 'kindred-paths:strategies:selected';

/** Default mana-value bucket config used when the strategies file doesn't specify buckets. */
const MV_BUCKET_CONFIG: BucketConfig = {
  buckets: [['mv:0', 'mv:1'], ['mv:2', 'mv:3'], ['mv:4', 'mv:5'], ['*']],
  toBucketName: (card, faceIndex) => {
    const face = card.faces[faceIndex];
    const mv = Object.entries(face.manaCost ?? {}).reduce(
      (sum, [type, amount]) => sum + (type === 'x' ? 0 : (amount ?? 0)),
      0,
    );
    return `mv:${mv}`;
  },
};

const MV_BUCKET_LABELS = ['MV 0–1', 'MV 2–3', 'MV 4–5', 'MV 6+'];

export function StrategiesTab(props: { cards: SerializedCard[] }) {
  const [strategyFiles, setStrategyFiles] = useState<string[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  // Read saved selection synchronously so we can fire the config fetch in parallel
  const [selected, setSelected] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_KEY); } catch { return null; }
  });
  const [staleSelected, setStaleSelected] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<SerializableStrategiesConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Parallel fetch: strategy file list + saved config (if any) on mount
  useEffect(() => {
    const savedOnMount = (() => { try { return localStorage.getItem(LS_KEY); } catch { return null; } })();

    setConfigLoading(savedOnMount !== null);

    Promise.all([
      fetchStrategyList(),
      savedOnMount ? fetchStrategies(savedOnMount).catch(() => null) : Promise.resolve(null),
    ]).then(([files, initialConfig]) => {
      setStrategyFiles(files);

      if (savedOnMount && files.includes(savedOnMount)) {
        // Saved selection is valid
        setSelected(savedOnMount);
        if (initialConfig) {
          setConfig(initialConfig);
          setConfigLoading(false);
        } else {
          // getStrategies failed, fetch again now that we confirmed the file exists
          fetchStrategies(savedOnMount)
            .then(c => { setConfig(c); setConfigLoading(false); })
            .catch(() => { setConfigError(`Failed to load strategies from "${savedOnMount}".`); setConfigLoading(false); });
        }
      } else if (savedOnMount && !files.includes(savedOnMount)) {
        // Saved selection is stale
        setStaleSelected(savedOnMount);
        const fallback = files.length > 0 ? files[0] : null;
        setSelected(fallback);
        if (fallback) {
          setConfigLoading(true);
          fetchStrategies(fallback)
            .then(c => { setConfig(c); setConfigLoading(false); })
            .catch(() => { setConfigError(`Failed to load strategies from "${fallback}".`); setConfigLoading(false); });
        } else {
          setConfigLoading(false);
        }
      } else if (!savedOnMount && files.length > 0) {
        // No saved selection, pick first
        const first = files[0];
        setSelected(first);
        setConfigLoading(true);
        fetchStrategies(first)
          .then(c => { setConfig(c); setConfigLoading(false); })
          .catch(() => { setConfigError(`Failed to load strategies from "${first}".`); setConfigLoading(false); });
      } else {
        setConfigLoading(false);
      }
    }).catch(() => {
      setListError('Failed to load strategy file list.');
      setConfigLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch config whenever selection changes (after initial mount)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (!selected) { setConfig(null); return; }
    setConfigLoading(true);
    setConfigError(null);
    fetchStrategies(selected)
      .then(result => { setConfig(result); setConfigLoading(false); })
      .catch(() => { setConfigError(`Failed to load strategies from "${selected}".`); setConfigLoading(false); });
  }, [selected]);

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function handleSelect(value: string) {
    setStaleSelected(null);
    setSelected(value);
    setDropdownOpen(false);
    localStorage.setItem(LS_KEY, value);
  }

  const aggregation: StrategyAggregation | null = useMemo(() => {
    if (!config?.strategies || config.strategies.length === 0) return null;
    return aggregateStrategies(props.cards, config.strategies, MV_BUCKET_CONFIG);
  }, [props.cards, config]);

  // --- Combined header card ---
  function HeaderCard({ children }: { children?: React.ReactNode }) {
    const files = strategyFiles ?? [];
    const strategyCount = config?.strategies?.length ?? null;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
        <div className="flex items-start gap-6">
          {/* File picker */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Strategy file</p>
            {files.length === 0 ? (
              <p className="text-sm text-slate-400">No strategy files found.</p>
            ) : (
              <div className="relative" ref={dropdownRef}>
                {/* Trigger button */}
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  className="flex items-center gap-2 text-left w-full group"
                >
                  <div className="min-w-0">
                    <span className="text-lg font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                      {(selected && config ? config.name : null) ?? selected ?? '—'}
                    </span>
                    {selected && strategyCount !== null && (
                      <span className="ml-2 text-sm text-slate-400">
                        {strategyCount} {strategyCount === 1 ? 'strategy' : 'strategies'}
                      </span>
                    )}
                    {selected && configLoading && (
                      <span className="ml-2 text-sm text-slate-400">Loading…</span>
                    )}
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown panel */}
                {dropdownOpen && (
                  <div className="absolute z-20 mt-2 left-0 min-w-[220px] bg-white border border-slate-200 rounded-lg shadow-lg py-1 overflow-hidden">
                    {files.map(f => {
                      const isSelected = f === selected;
                      return (
                        <button
                          key={f}
                          onClick={() => handleSelect(f)}
                          className={[
                            'w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors',
                            isSelected ? 'bg-blue-50' : '',
                          ].join(' ')}
                        >
                          {/* Checkmark */}
                          <span className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-500' : 'text-transparent'}`}>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          <div>
                            <p className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                              {isSelected && config?.name ? config.name : f}
                            </p>
                            {isSelected && config?.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
                            )}
                            {isSelected && strategyCount !== null && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {strategyCount} {strategyCount === 1 ? 'strategy' : 'strategies'}
                              </p>
                            )}
                            <p className="text-xs text-slate-400 mt-0.5">
                              collection/strategies/{f}.json
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Stale selection warning */}
            {staleSelected && (
              <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Saved selection &ldquo;{staleSelected}&rdquo; no longer exists — fell back to &ldquo;{selected}&rdquo;.
              </p>
            )}
          </div>

          {/* Divider */}
          {strategyCount !== null && (
            <div className="w-px self-stretch bg-slate-100 shrink-0" />
          )}

          {/* Stats */}
          {strategyCount !== null && (
            <div className="flex items-baseline gap-6 shrink-0">
              <div>
                <span className="text-3xl font-bold text-blue-600">{strategyCount}</span>
                <span className="text-sm text-slate-500 ml-1.5">strategies</span>
              </div>
              <div>
                <span className="text-2xl font-semibold text-slate-700">{props.cards.length}</span>
                <span className="text-sm text-slate-500 ml-1.5">cards</span>
              </div>
            </div>
          )}
        </div>
        {children}
      </div>
    );
  }

  // --- Loading / error states ---

  if (listError) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-red-500">
        {listError}
      </div>
    );
  }

  if (strategyFiles === null) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-400">
        Loading strategy files…
      </div>
    );
  }

  if (strategyFiles.length === 0) {
    return (
      <div className="space-y-4">
        <HeaderCard />
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-500">
          <p className="text-lg font-medium text-slate-700 mb-1">No strategy files found</p>
          <p className="text-sm">
            Add a <code className="bg-slate-100 px-1 rounded">.json</code> file to{' '}
            <code className="bg-slate-100 px-1 rounded">collection/strategies/</code> to get started.
          </p>
        </div>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="space-y-4">
        <HeaderCard />
      </div>
    );
  }

  if (configError) {
    return (
      <div className="space-y-4">
        <HeaderCard />
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-red-500">
          {configError}
        </div>
      </div>
    );
  }

  if (!config || !config.strategies || config.strategies.length === 0) {
    return (
      <div className="space-y-4">
        <HeaderCard />
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-500">
          <p className="text-lg font-medium text-slate-700 mb-1">No strategies defined in &ldquo;{selected}&rdquo;</p>
          <p className="text-sm">
            Add a <code className="bg-slate-100 px-1 rounded">strategies</code> array to the file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeaderCard />
      {aggregation && (
        <StrategiesGrid
          aggregation={aggregation}
          cards={props.cards}
          bucketLabels={MV_BUCKET_LABELS}
        />
      )}
    </div>
  );
}
