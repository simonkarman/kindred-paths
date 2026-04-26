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
import { StrategyEditorPanel } from './strategy-editor-panel';
import { useUrlParam } from '@/utils/use-url-param';

// ---------------------------------------------------------------------------
// Types + API helpers
// ---------------------------------------------------------------------------

type StrategyFileMeta = { filename: string; name: string; description?: string };

async function fetchStrategyList(): Promise<StrategyFileMeta[]> {
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

async function createStrategyFile(name: string): Promise<string> {
  const res = await fetch('/api/strategy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Failed to create file');
  }
  const data = await res.json();
  return data.filename as string;
}

async function deleteStrategyFile(filename: string): Promise<void> {
  const res = await fetch(`/api/strategy/${encodeURIComponent(filename.toLowerCase())}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Failed to delete file');
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LS_KEY = 'kindred-paths:strategies:selected';

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
// Component
// ---------------------------------------------------------------------------

export function StrategiesTab(props: { cards: SerializedCard[] }) {
  const [strategyFiles, setStrategyFiles] = useState<StrategyFileMeta[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  // URL param is the primary source of truth; localStorage is a fallback for
  // visits without a ?strategy= param.
  const [urlStrategy, setUrlStrategy] = useUrlParam('strategy', '');
  const [selected, setSelected] = useState<string | null>(() => {
    const fromUrl = urlStrategy || null;
    if (fromUrl) return fromUrl;
    try { return localStorage.getItem(LS_KEY); } catch { return null; }
  });
  const [staleSelected, setStaleSelected] = useState<string | null>(null);

  const [config, setConfig] = useState<SerializableStrategiesConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelStrategyIndex, setPanelStrategyIndex] = useState<number | null>(null);

  // Config metadata editing
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // New file creation
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [newFileSaving, setNewFileSaving] = useState(false);

  // Delete file
  const [showDeleteFile, setShowDeleteFile] = useState(false);
  const [deleteFileSaving, setDeleteFileSaving] = useState(false);
  const [deleteFileError, setDeleteFileError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const savedOnMount = selected;
    setConfigLoading(savedOnMount !== null);
    Promise.all([
      fetchStrategyList(),
      savedOnMount ? fetchStrategies(savedOnMount).catch(() => null) : Promise.resolve(null),
    ]).then(([files, initialConfig]) => {
      setStrategyFiles(files);
      if (savedOnMount && files.some(f => f.filename === savedOnMount)) {
        if (initialConfig) {
          setConfig(initialConfig);
          setConfigLoading(false);
        } else {
          fetchStrategies(savedOnMount)
            .then(c => { setConfig(c); setConfigLoading(false); })
            .catch(() => { setConfigError(`Failed to load strategies from "${savedOnMount}".`); setConfigLoading(false); });
        }
      } else if (savedOnMount && !files.some(f => f.filename === savedOnMount)) {
        setStaleSelected(savedOnMount);
        const fallback = files.length > 0 ? files[0].filename : null;
        setSelected(fallback);
        setUrlStrategy(fallback ?? '');
        if (fallback) localStorage.setItem(LS_KEY, fallback); else localStorage.removeItem(LS_KEY);
        if (fallback) {
          setConfigLoading(true);
          fetchStrategies(fallback)
            .then(c => { setConfig(c); setConfigLoading(false); })
            .catch(() => { setConfigError(`Failed to load strategies from "${fallback}".`); setConfigLoading(false); });
        } else {
          setConfigLoading(false);
        }
      } else if (!savedOnMount && files.length > 0) {
        const first = files[0].filename;
        setSelected(first);
        setUrlStrategy(first);
        localStorage.setItem(LS_KEY, first);
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

  // Refetch config on selection change (skip initial mount)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (!selected) { setConfig(null); return; }
    setConfigLoading(true);
    setConfigError(null);
    setEditMode(false);
    fetchStrategies(selected)
      .then(result => { setConfig(result); setConfigLoading(false); })
      .catch(() => { setConfigError(`Failed to load strategies from "${selected}".`); setConfigLoading(false); });
  }, [selected]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleSelect(value: string) {
    setStaleSelected(null);
    setSelected(value);
    setUrlStrategy(value);
    localStorage.setItem(LS_KEY, value);
  }

  function handleToggleEditMode() {
    const next = !editMode;
    setEditMode(next);
    if (!next) {
      setPanelOpen(false);
      setEditingMeta(false);
      setShowDeleteFile(false);
    }
  }

  function handleOpenPanel(index: number | null) {
    setPanelStrategyIndex(index);
    setPanelOpen(true);
  }

  function handlePanelSave(updatedConfig: SerializableStrategiesConfig) {
    setConfig(updatedConfig);
    setPanelOpen(false);
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    if (!config || !selected) return;
    const strategies = [...config.strategies];
    const [moved] = strategies.splice(fromIndex, 1);
    strategies.splice(toIndex, 0, moved);
    const updated: SerializableStrategiesConfig = { ...config, strategies };
    setConfig(updated);
    saveConfig(selected, updated).catch(() => setConfig(config));
  }

  // Metadata save
  function handleStartEditMeta() {
    setMetaName(config?.name ?? '');
    setMetaDescription(config?.description ?? '');
    setMetaError(null);
    setEditingMeta(true);
  }

  async function handleSaveMeta() {
    if (!config || !selected || !metaName.trim()) return;
    setMetaSaving(true);
    setMetaError(null);
    try {
      const updated: SerializableStrategiesConfig = {
        ...config,
        name: metaName.trim(),
        description: metaDescription.trim() || undefined,
      };
      const saved = await saveConfig(selected, updated);
      setConfig(saved);
      setEditingMeta(false);
    } catch (e) {
      setMetaError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setMetaSaving(false);
    }
  }

  // New file
  async function handleCreateFile() {
    const name = newFileName.trim();
    if (!name) return;
    setNewFileSaving(true);
    setNewFileError(null);
    try {
      const filename = await createStrategyFile(name);
      setStrategyFiles(prev => [...(prev ?? []), { filename, name }]);
      handleSelect(filename);
      setCreatingFile(false);
    } catch (e) {
      setNewFileError(e instanceof Error ? e.message : 'Failed to create file.');
    } finally {
      setNewFileSaving(false);
    }
  }

  // Delete file
  async function handleDeleteFile() {
    if (!selected) return;
    setDeleteFileSaving(true);
    setDeleteFileError(null);
    try {
      await deleteStrategyFile(selected);
      const newFiles = (strategyFiles ?? []).filter(f => f.filename !== selected);
      setStrategyFiles(newFiles);
      const next = newFiles.length > 0 ? newFiles[0].filename : null;
      setSelected(next);
      setUrlStrategy(next ?? '');
      if (next) localStorage.setItem(LS_KEY, next); else localStorage.removeItem(LS_KEY);
      setShowDeleteFile(false);
      setEditMode(false);
    } catch (e) {
      setDeleteFileError(e instanceof Error ? e.message : 'Failed to delete file.');
    } finally {
      setDeleteFileSaving(false);
    }
  }

  // Escape key exits edit mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && editMode) handleToggleEditMode();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const aggregation: StrategyAggregation | null = useMemo(() => {
    if (!config?.strategies || config.strategies.length === 0) return null;
    return aggregateStrategies(props.cards, config.strategies, MV_BUCKET_CONFIG);
  }, [props.cards, config]);

  const strategyCount = config?.strategies?.length ?? null;

  // New file input ref for autofocus
  const newFileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Tab bar JSX (inlined to avoid remount-on-render from nested fn components)
  // ---------------------------------------------------------------------------

  const tabBarFiles = strategyFiles ?? [];
  const tabBar = (
    <div>
      {/* Tab row */}
      <div className="flex items-end gap-0 border-b border-slate-200">
        {tabBarFiles.map(f => {
          const isActive = f.filename === selected;
          return (
            <button
              key={f.filename}
              onClick={() => handleSelect(f.filename)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                isActive
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              {f.name}
            </button>
          );
        })}

        {/* New tab / inline creation */}
        {!creatingFile ? (
          <button
            onClick={() => {
              setNewFileName('');
              setNewFileError(null);
              setCreatingFile(true);
              setTimeout(() => newFileInputRef.current?.focus(), 0);
            }}
            title="Create a new strategy file"
            className="px-3 py-2.5 text-sm border-b-2 border-transparent text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-2 pb-1.5 border-b-2 border-blue-400">
            <input
              ref={newFileInputRef}
              type="text"
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateFile();
                if (e.key === 'Escape') setCreatingFile(false);
              }}
              placeholder="File name…"
              className="text-sm border border-slate-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 w-32"
            />
            <button
              onClick={handleCreateFile}
              disabled={newFileSaving || !newFileName.trim()}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 font-medium transition disabled:opacity-50"
            >
              {newFileSaving ? '…' : 'Create'}
            </button>
            <button
              onClick={() => setCreatingFile(false)}
              className="text-xs text-slate-400 hover:text-slate-600 transition"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Inline error + stale warning below tab bar */}
      {newFileError && (
        <p className="text-xs text-red-500 mt-1 px-1">{newFileError}</p>
      )}
      {staleSelected && (
        <p className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Saved selection &ldquo;{staleSelected}&rdquo; no longer exists — fell back to &ldquo;{selected}&rdquo;.
        </p>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Card 2: Details (selected file name, description, stats, edit toggle)
  // ---------------------------------------------------------------------------

  const detailsCard = (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-5 py-4">
      <div className="flex items-center gap-6">
        {/* Name + description */}
        <div className="flex-1 min-w-0">
          {editingMeta ? (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                <input
                  type="text"
                  value={metaName}
                  onChange={e => setMetaName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <textarea
                  value={metaDescription}
                  onChange={e => setMetaDescription(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
              </div>
              {metaError && <p className="text-xs text-red-500">{metaError}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveMeta}
                  disabled={metaSaving || !metaName.trim()}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 font-medium transition disabled:opacity-50"
                >
                  {metaSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingMeta(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-semibold text-slate-800">
                  {config?.name ?? selected ?? '—'}
                </span>
                {configLoading && <span className="text-sm text-slate-400">Loading…</span>}
              </div>
              {config?.description && (
                <p className="text-sm text-slate-500 mt-0.5">{config.description}</p>
              )}
            </>
          )}
        </div>

        {/* Divider */}
        {strategyCount !== null && (
          <div className="w-px self-stretch bg-slate-100 shrink-0" />
        )}

        {/* Stats + edit toggle */}
        <div className="flex items-center gap-4 shrink-0">
          {strategyCount !== null && (
            <div className="flex items-baseline gap-6">
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

          {/* Edit mode toggle */}
          <button
            onClick={handleToggleEditMode}
            title={editMode ? 'Exit edit mode' : 'Enter edit mode'}
            className={[
              'flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md border transition',
              editMode
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                : 'text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600',
            ].join(' ')}
          >
            {editMode ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 019.9-1" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            )}
            {editMode ? 'Editing' : 'Edit'}
          </button>
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Edit mode banner
  // ---------------------------------------------------------------------------

  const editModeBanner = !editMode ? null : (
    <div
      className="bg-blue-600 text-white rounded-lg px-5 py-3 flex items-center justify-between cursor-pointer select-none hover:bg-blue-700 transition-colors"
      onClick={handleToggleEditMode}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleToggleEditMode(); }}
      aria-label="Exit edit mode"
    >
      <div className="flex items-center gap-2.5">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 019.9-1" />
        </svg>
        <div>
          <span className="font-semibold text-sm">Edit mode is on</span>
          <span className="ml-3 text-blue-200 text-xs">
            Drag rows to reorder · Click the pencil to edit a strategy · Click here or press Escape to exit
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {config && !editingMeta && (
          <button
            onClick={e => { e.stopPropagation(); handleStartEditMeta(); }}
            className="text-xs text-blue-100 hover:text-white border border-blue-400 hover:border-white rounded-md px-2.5 py-1 transition"
          >
            Rename
          </button>
        )}

        {selected && !showDeleteFile && (
          <button
            onClick={e => { e.stopPropagation(); setShowDeleteFile(true); setDeleteFileError(null); }}
            className="text-xs text-red-200 hover:text-white border border-red-400 hover:border-white rounded-md px-2.5 py-1 transition"
          >
            Delete file
          </button>
        )}
        {showDeleteFile && (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {deleteFileError && <span className="text-xs text-red-200">{deleteFileError}</span>}
            <span className="text-xs text-blue-100">Delete &ldquo;{selected}&rdquo;?</span>
            <button
              onClick={handleDeleteFile}
              disabled={deleteFileSaving}
              className="text-xs bg-red-500 hover:bg-red-600 text-white rounded-md px-2.5 py-1 font-medium transition disabled:opacity-50"
            >
              {deleteFileSaving ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setShowDeleteFile(false)}
              className="text-xs text-blue-200 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        )}

        <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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

  if (configLoading) {
    return (
      <div className="space-y-4">
        {tabBar}
      </div>
    );
  }

  if (configError) {
    return (
      <div className="space-y-4">
        {tabBar}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-red-500">
          {configError}
        </div>
      </div>
    );
  }

  if (!config || !config.strategies || config.strategies.length === 0) {
    return (
      <div className="space-y-4">
        {tabBar}
        {selected && detailsCard}
        {editModeBanner}
        {config && editMode && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-500">
            <p className="text-lg font-medium text-slate-700 mb-3">No strategies defined</p>
            <button
              onClick={() => handleOpenPanel(null)}
              className="inline-flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 font-medium transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add first strategy
            </button>
          </div>
        )}
        {config && !editMode && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-500">
            <p className="text-lg font-medium text-slate-700 mb-1">No strategies defined in &ldquo;{selected}&rdquo;</p>
            <p className="text-sm">Click <strong>Edit</strong> to add strategies.</p>
          </div>
        )}
        {!config && strategyFiles.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-500">
            <p className="text-lg font-medium text-slate-700 mb-1">No strategy files found</p>
            <p className="text-sm">
              Use the <strong>+</strong> tab above or add a{' '}
              <code className="bg-slate-100 px-1 rounded">.json</code> file to{' '}
              <code className="bg-slate-100 px-1 rounded">collection/strategies/</code> to get started.
            </p>
          </div>
        )}
        {panelOpen && config && selected && (
          <StrategyEditorPanel
            filename={selected}
            config={config}
            strategy={null}
            strategyIndex={null}
            cards={props.cards}
            onSave={handlePanelSave}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tabBar}
      {detailsCard}
      {editModeBanner}
      {aggregation && (
        <StrategiesGrid
          aggregation={aggregation}
          cards={props.cards}
          bucketLabels={MV_BUCKET_LABELS}
          editMode={editMode}
          onEdit={handleOpenPanel}
          onReorder={handleReorder}
          onAddStrategy={() => handleOpenPanel(null)}
        />
      )}
      {panelOpen && config && selected && (
        <StrategyEditorPanel
          filename={selected}
          config={config}
          strategy={panelStrategyIndex !== null ? (config.strategies[panelStrategyIndex] ?? null) : null}
          strategyIndex={panelStrategyIndex}
          cards={props.cards}
          onSave={handlePanelSave}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}
