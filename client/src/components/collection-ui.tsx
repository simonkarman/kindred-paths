"use client";

import { Collection, SyncResult } from 'kindred-paths';
import { useLocalStorageState } from '@/utils/use-local-storage-state';
import { getCollection, syncCollection, commitCollection } from '@/utils/server';
import { useEffect, useState } from 'react';

type CachedCollection = {
  data: Collection;
  timestamp: number;
};

export function CollectionUI() {
  const [cached, setCached] = useLocalStorageState<CachedCollection | null>(
    'collection-cache',
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [operationResult, setOperationResult] = useState<SyncResult | null>(null);

  // Revalidate every 30 seconds
  useEffect(() => {
    const shouldRevalidate = !cached || Date.now() - cached.timestamp > 5000;

    if (shouldRevalidate) {
      getCollection().then((data) => {
        setCached({ data, timestamp: Date.now() });
      }).catch(console.error);
    }

    const interval = setInterval(() => {
      getCollection().then((data) => {
        setCached({ data, timestamp: Date.now() });
      }).catch(console.error);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  if (!cached) {
    return (
      <button className="px-3 py-1 text-sm rounded bg-gray-200 text-gray-600">
        Loading...
      </button>
    );
  }

  const collection = cached.data;
  const hasLocalChanges = collection.status.local.modifications.length > 0;
  const hasIncomingChanges = collection.status.remote.hasIncomingChanges;

  // Determine button color and text
  const getStatusColor = () => {
    if (hasLocalChanges && hasIncomingChanges) return 'bg-red-500 hover:bg-red-600';
    if (hasLocalChanges) return 'bg-yellow-500 hover:bg-yellow-600';
    if (hasIncomingChanges) return 'bg-blue-500 hover:bg-blue-600';
    return 'bg-green-500 hover:bg-green-600';
  };

  const getStatusText = () => {
    if (hasLocalChanges && hasIncomingChanges) return 'Conflict ⚠';
    if (hasLocalChanges) return '●';
    if (hasIncomingChanges) return '↓';
    return '✓';
  };

  const handleSync = async () => {
    setIsLoading(true);
    setOperationResult(null);
    try {
      const result = await syncCollection();
      setOperationResult(result);
      if (result.success) {
        // Refresh collection data
        const data = await getCollection();
        setCached({ data, timestamp: Date.now() });
      }
    } catch (error) {
      setOperationResult({
        success: false,
        error: 'Failed to sync',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setOperationResult({
        success: false,
        error: 'Commit message is required'
      });
      return;
    }

    setIsLoading(true);
    setOperationResult(null);
    try {
      const result = await commitCollection(commitMessage);
      setOperationResult(result);
      if (result.success) {
        setCommitMessage('');
        // Refresh collection data
        const data = await getCollection();
        setCached({ data, timestamp: Date.now() });
      }
    } catch (error) {
      setOperationResult({
        success: false,
        error: 'Failed to commit',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
      setCommitMessage('');
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`px-3 py-1 text-sm font-medium rounded text-white transition-colors ${getStatusColor()}`}
        title="Collection status"
      >
        {getStatusText()}
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold">Collection Status</h2>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setOperationResult(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Storage Backend Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Storage Backend</h3>
                {collection.storage.type === 'none' ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <p className="text-yellow-800">
                      No version control configured. Set up a git repository in the content directory to enable syncing.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded p-4 space-y-1">
                    <p><span className="font-medium">Type:</span> Git</p>
                    <p><span className="font-medium">Repository:</span> {collection.storage.repositoryUrl}</p>
                    <p><span className="font-medium">Branch:</span> {collection.storage.branch}</p>
                  </div>
                )}
              </div>

              {/* Local Status */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Local Changes</h3>
                {hasLocalChanges ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {collection.status.local.modifications.length} file(s) modified
                    </p>
                    <div className="bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
                      {collection.status.local.modifications.map((mod, idx) => (
                        <div key={idx} className="text-sm py-1 flex items-center gap-2">
                          <span className={
                            mod.operation === 'addition' ? 'text-green-600' :
                              mod.operation === 'modification' ? 'text-yellow-600' :
                                'text-red-600'
                          }>
                            {mod.operation === 'addition' ? '+' :
                              mod.operation === 'modification' ? '~' : '-'}
                          </span>
                          <span className="font-mono text-xs">{mod.path}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-green-600">No local changes</p>
                )}
              </div>

              {/* Remote Status */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Remote Status</h3>
                {hasIncomingChanges ? (
                  <p className="text-blue-600">Incoming changes available</p>
                ) : (
                  <p className="text-gray-600">Up to date with remote</p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Last checked: {new Date(collection.status.remote.lastChecked).toLocaleString()}
                </p>
              </div>

              {/* Operation Result */}
              {operationResult && (
                <div className={`mb-6 p-4 rounded ${
                  operationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={operationResult.success ? 'text-green-800' : 'text-red-800'}>
                    {operationResult.success ? operationResult.message : operationResult.error}
                  </p>
                  {!operationResult.success && operationResult.details && (
                    <p className="text-sm mt-1 text-gray-600">{operationResult.details}</p>
                  )}
                </div>
              )}

              {/* Actions */}
              {collection.storage.type === 'git' && (
                <div className="space-y-4">
                  {/* Commit Section */}
                  {hasLocalChanges && (
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold mb-2">Commit Changes</h3>
                      <input
                        type="text"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Enter commit message..."
                        className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
                        disabled={isLoading}
                      />
                      <button
                        onClick={handleCommit}
                        disabled={isLoading || !commitMessage.trim()}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium"
                      >
                        {isLoading ? 'Committing...' : 'Commit & Push'}
                      </button>
                    </div>
                  )}

                  {/* Sync Section */}
                  {hasIncomingChanges && !hasLocalChanges && (
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold mb-2">Pull Changes</h3>
                      <button
                        onClick={handleSync}
                        disabled={isLoading}
                        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium"
                      >
                        {isLoading ? 'Pulling...' : 'Pull Remote Changes'}
                      </button>
                    </div>
                  )}

                  {/* Warning when both exist */}
                  {hasIncomingChanges && hasLocalChanges && (
                    <div className="border-t pt-4 bg-orange-50 border border-orange-200 rounded p-4">
                      <p className="text-orange-800">
                        You have both local changes and incoming remote changes. Commit your changes first before pulling.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
