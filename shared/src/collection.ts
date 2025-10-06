export type StorageBackend =
  | { type: 'none' }
  | {
  type: 'git',
  repositoryUrl: string,
  branch: string
};

export type FileModification = {
  operation: 'addition' | 'modification' | 'deletion',
  path: string,
};

export type LocalSyncStatus = {
  lastSyncCommit: string,
  lastSyncTime: string,
  modifications: FileModification[],
};

export type RemoteSyncStatus = {
  hasIncomingChanges: boolean,
  lastChecked: string,
};

export type SyncStatus = {
  local: LocalSyncStatus,
  remote: RemoteSyncStatus,
};

export type Collection = {
  storage: StorageBackend,
  status: SyncStatus
};

export type SyncResult =
  | {
  success: true,
  message: string,
}
  | {
  success: false,
  error: string,
  details?: string,
};
