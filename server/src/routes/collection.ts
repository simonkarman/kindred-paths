import { Router } from 'express';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { Collection, FileModification, LocalSyncStatus, RemoteSyncStatus, StorageBackend, SyncResult, SyncStatus } from 'kindred-paths';
import { configuration } from '../configuration';

export const collectionRouter = Router();

// Abstract base class for storage backends
abstract class StorageBackendAdapter {
  constructor(protected directory: string) {}

  abstract getBackendInfo(): Promise<StorageBackend>;
  abstract getSyncStatus(): Promise<SyncStatus>;
  abstract sync(): Promise<SyncResult>;
  abstract commit(message: string): Promise<SyncResult>;
}

// None storage backend implementation
class NoneStorageBackend extends StorageBackendAdapter {
  async getBackendInfo(): Promise<StorageBackend> {
    return { type: 'none' };
  }

  private async getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        if (file === '.git') continue;

        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
          arrayOfFiles = await this.getAllFiles(filePath, arrayOfFiles);
        } else {
          arrayOfFiles.push(path.relative(this.directory, filePath));
        }
      }

      return arrayOfFiles;
    } catch {
      return arrayOfFiles;
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const files = await this.getAllFiles(this.directory);
      const modifications: FileModification[] = files.map(path => ({
        operation: 'addition' as const,
        path,
      }));

      return {
        local: {
          lastSyncCommit: '',
          lastSyncTime: new Date(0).toISOString(),
          modifications,
        },
        remote: {
          hasIncomingChanges: false,
          lastChecked: new Date().toISOString(),
        },
      };
    } catch {
      return {
        local: {
          lastSyncCommit: '',
          lastSyncTime: new Date(0).toISOString(),
          modifications: [],
        },
        remote: {
          hasIncomingChanges: false,
          lastChecked: new Date().toISOString(),
        },
      };
    }
  }

  async sync(): Promise<SyncResult> {
    return {
      success: true,
      message: 'No-op for none backend',
    };
  }

  async commit(message: string): Promise<SyncResult> {
    return {
      success: true,
      message: 'No-op for none backend',
    };
  }
}

// Git storage backend implementation
class GitStorageBackend extends StorageBackendAdapter {
  private git: SimpleGit;

  constructor(directory: string) {
    super(directory);
    this.git = simpleGit(directory);
  }

  async getBackendInfo(): Promise<StorageBackend> {
    try {
      const remotes = await this.git.getRemotes(true);
      const currentBranch = await this.git.branchLocal();

      const origin = remotes.find(r => r.name === 'origin');
      const repositoryUrl = origin?.refs.fetch || '';
      const branch = currentBranch.current;

      return {
        type: 'git',
        repositoryUrl,
        branch,
      };
    } catch {
      throw new Error('Failed to get git repository info');
    }
  }

  private async getLocalSyncStatus(): Promise<LocalSyncStatus> {
    const status = await this.git.status();
    const log = await this.git.log({ maxCount: 1 });

    const modifications: FileModification[] = [
      ...status.created.map(p => ({ operation: 'addition' as const, path: p })),
      ...status.modified.map(p => ({ operation: 'modification' as const, path: p })),
      ...status.deleted.map(p => ({ operation: 'deletion' as const, path: p })),
      ...status.not_added.map(p => ({ operation: 'addition' as const, path: p })),
    ];

    return {
      lastSyncCommit: log.latest?.hash || '',
      lastSyncTime: log.latest?.date || new Date().toISOString(),
      modifications,
    };
  }

  private async getRemoteSyncStatus(): Promise<RemoteSyncStatus> {
    try {
      await this.git.fetch();
      const status = await this.git.status();

      return {
        hasIncomingChanges: status.behind > 0,
        lastChecked: new Date().toISOString(),
      };
    } catch {
      return {
        hasIncomingChanges: false,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const local = await this.getLocalSyncStatus();
    const remote = await this.getRemoteSyncStatus();
    return { local, remote };
  }

  async sync(): Promise<SyncResult> {
    try {
      const local = await this.getLocalSyncStatus();

      if (local.modifications.length > 0) {
        return {
          success: false,
          error: 'Cannot sync with local changes. Commit your changes first.',
        };
      }

      const backendInfo = await this.getBackendInfo();
      if (backendInfo.type !== 'git') {
        throw new Error('Invalid backend type');
      }

      // Fetch and pull with merge strategy
      await this.git.fetch();
      await this.git.pull('origin', backendInfo.branch, { '--no-rebase': null });

      // Push to remote (in case auto-merging created new commits)
      await this.git.push('origin', backendInfo.branch);

      return {
        success: true,
        message: 'Successfully pulled changes',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if it's a merge conflict
      if (errorMessage.includes('CONFLICT') || errorMessage.includes('conflict')) {
        return {
          success: false,
          error: 'Merge conflict detected. Please resolve manually via command line.',
          details: errorMessage,
        };
      }

      return {
        success: false,
        error: 'Failed to sync',
        details: errorMessage,
      };
    }
  }

  async commit(message: string): Promise<SyncResult> {
    try {
      const backendInfo = await this.getBackendInfo();
      if (backendInfo.type !== 'git') {
        throw new Error('Invalid backend type');
      }

      // Add all changes
      await this.git.add('.');

      // Commit
      await this.git.commit(message);

      // If there are remote changes, pull first to avoid non-fast-forward errors
      const remoteStatus = await this.getRemoteSyncStatus();
      if (remoteStatus.hasIncomingChanges) {
        await this.git.pull('origin', backendInfo.branch, { '--no-rebase': null });
      }

      // Push to remote
      await this.git.push('origin', backendInfo.branch);

      return {
        success: true,
        message: 'Successfully committed and pushed changes',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: 'Failed to commit and push',
        details: errorMessage,
      };
    }
  }
}

// Factory function to detect and create the appropriate backend
async function getActiveStorageBackend(): Promise<StorageBackendAdapter> {
  try {
    const gitDir = path.join(configuration.collectionRootDir, '.git');
    const stats = await fs.stat(gitDir);

    if (stats.isDirectory()) {
      return new GitStorageBackend(configuration.collectionRootDir);
    }
  } catch {
    // Not a git repository
  }

  return new NoneStorageBackend(configuration.collectionRootDir);
}

// GET / - Return collection info
collectionRouter.get('/', async (_, res) => {
  try {
    const backend = await getActiveStorageBackend();
    const storage = await backend.getBackendInfo();
    const status = await backend.getSyncStatus();

    const collection: Collection = {
      storage,
      status,
    };

    res.json(collection);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get collection info',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /sync - Pull remote changes
collectionRouter.post('/sync', async (_, res) => {
  try {
    const backend = await getActiveStorageBackend();
    const result = await backend.sync();

    if (!result.success) {
      const statusCode = result.error?.includes('local changes')
        ? 400
        : result.error?.includes('conflict')
          ? 409
          : 500;
      res.status(statusCode).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to sync',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /commit - Commit and push changes
collectionRouter.post('/commit', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Commit message is required',
      });
      return;
    }

    const backend = await getActiveStorageBackend();
    const result = await backend.commit(message);

    if (!result.success) {
      res.status(500).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to commit and push',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
