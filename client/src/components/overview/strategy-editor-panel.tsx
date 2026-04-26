"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  aggregateStrategies,
  BucketConfig,
  SerializableStrategiesConfig,
  SerializableStrategy,
  SerializedCard,
  StrategyFilter,
  getFilterQuery,
  getFilterWeight,
} from 'kindred-paths';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftFilter {
  id: number;
  query: string;
  useWeight: boolean;
  weight: number;
}

interface Props {
  filename: string;
  config: SerializableStrategiesConfig;
  strategy: SerializableStrategy | null; // null = new
  strategyIndex: number | null;          // null = new
  cards: SerializedCard[];
  onSave: (updatedConfig: SerializableStrategiesConfig) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Bucket config (same as strategies-tab)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextId = 1;
function newId() { return nextId++; }

function strategyToFilters(strategy: SerializableStrategy): DraftFilter[] {
  return strategy.filters.map(f => ({
    id: newId(),
    query: getFilterQuery(f),
    useWeight: getFilterWeight(f) !== 1,
    weight: getFilterWeight(f),
  }));
}

function filtersToStrategy(name: string, description: string, filters: DraftFilter[]): SerializableStrategy {
  return {
    name,
    description: description.trim() || undefined,
    filters: filters.map((f): StrategyFilter => {
      if (f.useWeight && f.weight !== 1) {
        return { query: f.query, weight: f.weight };
      }
      return f.query;
    }),
  };
}

async function saveConfig(filename: string, config: SerializableStrategiesConfig): Promise<SerializableStrategiesConfig> {
  const res = await fetch(`/api/strategy/${encodeURIComponent(filename.toLowerCase())}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Failed to save');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Mini preview grid
// ---------------------------------------------------------------------------

function MiniPreviewGrid({ strategy, cards }: { strategy: SerializableStrategy | null; cards: SerializedCard[] }) {
  const aggregation = useMemo(() => {
    if (!strategy || strategy.filters.length === 0) return null;
    // Filter out empty queries
    const validFilters = strategy.filters.filter(f => getFilterQuery(f).trim() !== '');
    if (validFilters.length === 0) return null;
    const s = { ...strategy, filters: validFilters };
    try {
      return aggregateStrategies(cards, [s], MV_BUCKET_CONFIG);
    } catch {
      return null;
    }
  }, [strategy, cards]);

  if (!aggregation) {
    return (
      <p className="text-xs text-slate-400 italic">No filters defined yet.</p>
    );
  }

  const row = aggregation.rows[0];
  if (!row || row.total === 0) {
    return (
      <p className="text-xs text-slate-400 italic">No cards match the current filters.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="text-left py-1.5 pr-2 font-medium">Bucket</th>
            <th className="text-right py-1.5 pr-2 font-medium">Cards</th>
            <th className="text-left py-1.5 font-medium">Colors</th>
          </tr>
        </thead>
        <tbody>
          {row.buckets.map((cell, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-1 pr-2 text-slate-600 font-medium">{MV_BUCKET_LABELS[i]}</td>
              <td className="py-1 pr-2 text-right font-semibold text-slate-700">{cell.total > 0 ? cell.total : '—'}</td>
              <td className="py-1">
                <div className="flex flex-wrap gap-1">
                  {cell.colors
                    .filter(c => c.count > 0)
                    .sort((a, b) => b.count - a.count)
                    .map(c => (
                      <span
                        key={c.color}
                        className="inline-flex items-center gap-0.5 text-slate-700 bg-slate-100 rounded px-1.5 py-0.5 capitalize"
                      >
                        {c.color}
                        <span className="text-slate-400 font-mono ml-0.5">{c.count.toFixed(1)}</span>
                      </span>
                    ))}
                </div>
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50">
            <td className="py-1.5 pr-2 font-semibold text-slate-700">Total</td>
            <td className="py-1.5 pr-2 text-right font-bold text-blue-600">{row.total}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function StrategyEditorPanel({ filename, config, strategy, strategyIndex, cards, onSave, onClose }: Props) {
  const isNew = strategy === null;

  const [name, setName] = useState(strategy?.name ?? '');
  const [description, setDescription] = useState(strategy?.description ?? '');
  const [filters, setFilters] = useState<DraftFilter[]>(() =>
    strategy ? strategyToFilters(strategy) : [{ id: newId(), query: '', useWeight: false, weight: 2 }]
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Debounced draft strategy for live preview
  const [draftStrategy, setDraftStrategy] = useState<SerializableStrategy | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rebuildDraft = useCallback((n: string, d: string, fs: DraftFilter[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!n.trim() || fs.length === 0) { setDraftStrategy(null); return; }
      setDraftStrategy(filtersToStrategy(n, d, fs));
    }, 200);
  }, []);

  // Rebuild whenever fields change
  useEffect(() => { rebuildDraft(name, description, filters); }, [name, description, filters, rebuildDraft]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // -------------------------------------------------------------------------
  // Filter operations
  // -------------------------------------------------------------------------

  function addFilter() {
    setFilters(fs => [...fs, { id: newId(), query: '', useWeight: false, weight: 2 }]);
  }

  function removeFilter(id: number) {
    setFilters(fs => fs.filter(f => f.id !== id));
  }

  function updateFilter(id: number, patch: Partial<DraftFilter>) {
    setFilters(fs => fs.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  const nameError = name.trim() === '' ? 'Name is required.' : null;
  const filtersError = filters.length === 0
    ? 'At least one filter is required.'
    : filters.some(f => f.query.trim() === '')
      ? 'All filters must have a query.'
      : null;
  const hasError = nameError !== null || filtersError !== null;

  // -------------------------------------------------------------------------
  // Save / delete
  // -------------------------------------------------------------------------

  async function handleSave() {
    if (hasError) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = filtersToStrategy(name, description, filters);
      const newStrategies = [...config.strategies];
      if (isNew) {
        newStrategies.push(updated);
      } else {
        newStrategies[strategyIndex!] = updated;
      }
      const newConfig: SerializableStrategiesConfig = { ...config, strategies: newStrategies };
      const saved = await saveConfig(filename, newConfig);
      onSave(saved);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setSaveError(null);
    try {
      const newStrategies = config.strategies.filter((_, i) => i !== strategyIndex);
      const newConfig: SerializableStrategiesConfig = { ...config, strategies: newStrategies };
      const saved = await saveConfig(filename, newConfig);
      onSave(saved);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to delete.');
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-40 w-[540px] max-w-full bg-white shadow-2xl border-l border-slate-200 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h2 className="font-semibold text-slate-800 text-base">
            {isNew ? 'New strategy' : 'Edit strategy'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Token Generation"
              className={[
                'w-full text-sm border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 transition',
                nameError ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white',
              ].join(' ')}
            />
            {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Description <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this strategy tracks…"
              rows={2}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 transition resize-none"
            />
          </div>

          {/* Filters */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Filters <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {filters.map((f) => (
                <div key={f.id} className="flex flex-col gap-1 bg-slate-50 border border-slate-200 rounded-md p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={f.query}
                      onChange={e => updateFilter(f.id, { query: e.target.value })}
                      placeholder='e.g. rules:"create a token"'
                      className={[
                        'flex-1 text-sm font-mono border rounded px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 transition',
                        f.query.trim() === '' ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white',
                      ].join(' ')}
                    />
                    <button
                      onClick={() => removeFilter(f.id)}
                      disabled={filters.length === 1}
                      title="Remove filter"
                      className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition shrink-0 px-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={f.useWeight}
                        onChange={e => updateFilter(f.id, { useWeight: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      Custom weight
                    </label>
                    {f.useWeight && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">×</span>
                        <input
                          type="number"
                          value={f.weight}
                          min={0.1}
                          step={0.5}
                          onChange={e => updateFilter(f.id, { weight: parseFloat(e.target.value) || 1 })}
                          className="w-20 text-sm border border-slate-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 transition"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {filtersError && <p className="text-xs text-red-500 mt-1">{filtersError}</p>}
            <button
              onClick={addFilter}
              className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add filter
            </button>
          </div>

          {/* Live preview */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Live preview</p>
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
              <MiniPreviewGrid strategy={draftStrategy} cards={cards} />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 px-5 py-4 bg-white">
          {saveError && (
            <p className="text-xs text-red-500 mb-3">{saveError}</p>
          )}
          <div className="flex items-center gap-2">
            {/* Delete (existing only) */}
            {!isNew && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-md px-3 py-2 transition disabled:opacity-50"
              >
                Delete
              </button>
            )}
            {!isNew && showDeleteConfirm && (
              <div className="flex items-center gap-2 mr-auto">
                <span className="text-xs text-red-600">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="text-xs bg-red-500 hover:bg-red-600 text-white rounded-md px-3 py-2 font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={saving}
                  className="text-xs text-slate-500 hover:text-slate-700 transition"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-md px-4 py-2 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || hasError}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
