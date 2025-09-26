import { Injectable, signal, inject, effect, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, firstValueFrom, single } from 'rxjs';
import { SocketService } from './socket.service';
import { AuthService } from './auth.service';
import { ScriptRunService } from './script-run.service';
import { compileClassDebugInfo } from '@angular/compiler';

export interface Script {
  id: number;
  name: string;
  description: string;
  type: 'powershell' | 'batch' | 'bash';
  filePath?: string;
  scriptContent?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Pagination {
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number;
  prevPage: number;
  currentPage: number;
  totalItems: number;
}

export interface ScriptRun {
  id: number;
  scriptId: number;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  output?: string;
  error?: string;
  content?: string;
  progress?: number;
  executionPath?: string;
}

export interface ScriptRunResponse {
  scriptRuns: ScriptRun[];
  message: string;
  pagination: Pagination;
}

export interface FileInfo {
  id: number;
  name: string;
  type: 'folder' | 'file';
  size: number;
  mtime: string;
  path: string;
}

export interface CreateScriptRequest {
  name: string;
  description: string;
  type: 'powershell' | 'batch' | 'bash';
  scriptContent: string;
}

export interface RunScriptRequest {
  scriptId: number;
  executionPath?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ScriptService {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  private authService = inject(AuthService);

  // Use AuthService's API URL signal
  private get apiUrl() {
    return this.authService.getApiUrlSignal();
  }

  private scripts = signal<Script[]>([]);
  private pagination = signal<Pagination | null>(null);
  // private scriptRuns = signal<ScriptRun[]>([]);
  private files = signal<FileInfo[]>([]);
  private isLoading = signal<boolean>(false);
  private currentRunProgress = signal<{ [runId: number]: number }>({});

  private totalPages = signal<number>(0);

  private latestScriptRunMap = signal<Map<number, ScriptRun>>(
    new Map<number, ScriptRun>()
  );

  private scriptRunService = inject(ScriptRunService);
  // private authService = inject(AuthService);
  constructor() {
    // Already initialized above
  }

  init() {
    this.apiUrl.set(
      localStorage.getItem('apiUrl') || environment.backendBaseUrl
    );
    this.loadScripts().then(() => {
      this.loadLatestScriptRuns();
    });
    this.loadFiles();
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    // Listen for run updates
    this.socketService.getRunUpdates().subscribe((update) => {
      if (update) {
        let updateRun = null,
          scriptId = null;
        for (let [script, run] of this.latestScriptRunMap()) {
          if (run.id === update.runId) {
            updateRun = {
              ...run,
              status:
                (update.status as 'running' | 'completed' | 'failed') ||
                'running',
              output: update.output || run.output,
              error: update.error || run.error,
              endTime: update.endTime || run.endTime,
              progress: update.progress || run.progress,
            };
            scriptId = script;
          }
        }

        if (updateRun && scriptId) {
          let newMap = new Map<number, ScriptRun>(this.latestScriptRunMap());
          newMap.set(scriptId, updateRun);
          this.latestScriptRunMap.set(newMap);
          // Update progress if available
          if (update.progress !== undefined) {
            console.log('the progresssss :', update.progress);
            this.currentRunProgress.set({
              ...this.currentRunProgress(),
              [update.runId]: update.progress,
            });
          }
        }
      }
    });

    // Listen for log updates
    /* this.socketService.getLogUpdates().subscribe((update) => {
      if (update) {
        const runs = this.scriptRuns();
        const runIndex = runs.findIndex((run) => run.id === update.runId);

        if (runIndex !== -1) {
          const updatedRuns = [...runs];
          updatedRuns[runIndex] = {
            ...updatedRuns[runIndex],
            output: update.content,
          };
          this.scriptRuns.set(updatedRuns);
        }
      }
    }); */
  }

  // Scripts
  async loadScripts(): Promise<void> {
    try {
      this.isLoading.set(true);
      const response = await firstValueFrom(
        this.http.get<{
          scripts: Script[];
          message: string;
          pagination: Pagination;
        }>(`${this.apiUrl()}/scripts`)
      );
      console.log('response ', response);
      this.scripts.set(response.scripts);
    } catch (error) {
      console.error('Error loading scripts:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Load scripts with pagination support
   */
  async loadScriptsWithPagination(page: number = 1): Promise<void> {
    try {
      this.isLoading.set(true);
      const response = await firstValueFrom(
        this.http.get<{
          scripts: Script[];
          pagination: Pagination;
          message: string;
        }>(`${this.apiUrl()}/scripts?page=${page}`)
      );
      this.scripts.set(response.scripts);
      this.pagination.set(response.pagination);
    } catch (error) {
      console.error('Error loading scripts:', error);
      this.scripts.set([]);
      this.pagination.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Files
  async loadFiles(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ files: FileInfo[]; message: string }>(
          `${this.apiUrl()}/scripts/files`
        )
      );
      console.log('Files response:', response);
      this.files.set(response.files);
    } catch (error) {
      console.error('Error loading files:', error);
      this.files.set([]);
    }
  }

  async loadLatestScriptRuns(): Promise<void> {
    try {
      this.scripts().forEach(async (script) => {
        const run = await this.scriptRunService.getLatestRunForScript(
          script.id
        );
        if (run) {
          let newMap = new Map<number, ScriptRun>(this.latestScriptRunMap());
          newMap.set(script.id, run);
          this.latestScriptRunMap.set(newMap);
          if (run.status === 'running') {
            this.socketService.watchScriptRun(run.id);
          }
          // this.scriptRuns.set([...this.scriptRuns(), run]);
        }
      });

      // console.log('script runs', this.scriptRunsMap);

      // const response = await firstValueFrom(
      //   this.http.get<{ scriptRuns: ScriptRun[]; message: string }>(
      //     `${this.apiUrl()}/scripts/runs/all`
      //   )
      // );
      // this.scriptRuns.set(response.scriptRuns);
    } catch (error) {
      console.error('Error loading script runs:', error);
      this.latestScriptRunMap().clear();
    }
  }

  getScripts() {
    return this.scripts.asReadonly();
  }

  getPagination() {
    return this.pagination.asReadonly();
  }

  setPage(page: number) {
    this.loadScriptsWithPagination(page);
  }

  public getFiles() {
    return this.files.asReadonly();
  }

  getScriptRuns() {
    /* return this.scriptRuns.asReadonly(); */
  }

  getTotalPages() {
    return this.totalPages;
  }

  getIsLoading() {
    return this.isLoading.asReadonly();
  }

  async getScript(id: number): Promise<Script | null> {
    try {
      return await firstValueFrom(
        this.http.get<Script>(`${this.apiUrl()}/scripts/${id}`)
      );
    } catch (error) {
      console.error('Error getting script:', error);
      return null;
    }
  }

  async getScriptContent(id: number): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.apiUrl()}/scripts/${id}/content`, {
          responseType: 'text',
        })
      );
      return response;
    } catch (error) {
      console.error('Error getting script content:', error);
      return null;
    }
  }

  async getScriptRun(runId: number): Promise<ScriptRun | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ scriptRun: ScriptRun; message: string }>(
          `${this.apiUrl()}/scripts/runs/${runId}`
        )
      );
      return response.scriptRun;
    } catch (error) {
      console.error('Error getting script run:', error);
      return null;
    }
  }

  async getScriptRunsForScript(scriptId: number): Promise<ScriptRun[]> {
    try {
      return await firstValueFrom(
        this.http.get<ScriptRun[]>(`${this.apiUrl()}/scripts/${scriptId}/runs`)
      );
    } catch (error) {
      console.error('Error getting script runs:', error);
      return [];
    }
  }

  async createScript(
    script: CreateScriptRequest,
    files?: File[]
  ): Promise<Script | null> {
    try {
      this.isLoading.set(true);
      /*       const formData: FormData = new FormData();

      formData.append('name', script.name);
      formData.append('description', script.description);
      formData.append('type', script.type);
      formData.append('scriptContent', script.scriptContent);
 */
      const newScript = await firstValueFrom(
        this.http.post<Script>(`${this.apiUrl()}/scripts/add`, {
          name: script.name,
          description: script.description,
          type: script.type,
          scriptContent: script.scriptContent,
        })
      );

      // Refresh the scripts list
      await this.loadScripts();
      return newScript;
    } catch (error: any) {
      console.error('Error creating script:', error);
      throw error.error.error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async uploadFiles(formData: FormData): Promise<Script | null> {
    try {
      this.isLoading.set(true);
      const newScript = await firstValueFrom(
        this.http.post<Script>(`${this.apiUrl()}/scripts/files/add`, formData)
      );

      // Refresh the scripts list
      await this.loadScriptsWithPagination();
      return newScript;
    } catch (error: any) {
      console.error('Error creating script from file:', error);
      throw error.error.error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async runScript(
    scriptId: number,
    executionPath?: string
  ): Promise<ScriptRun | null> {
    try {
      const request: RunScriptRequest = { scriptId, executionPath };
      const run = await this.scriptRunService.runScript(request);

      let newMap = new Map<number, ScriptRun>(this.latestScriptRunMap());
      newMap.set(scriptId, run);
      this.latestScriptRunMap.set(newMap);
      this.socketService.watchScriptRun(run.id);

      // Start watching the run with socket

      // Refresh script runs
      await this.loadLatestScriptRuns();
      // await this.loadAllScriptRuns();
      return run;
    } catch (error) {
      console.error('Error running script:', error);
      return null;
    }
  }

  async updateScript(
    id: number,
    updates: Partial<CreateScriptRequest>
  ): Promise<Script | null> {
    try {
      this.isLoading.set(true);
      const updatedScript = await firstValueFrom(
        this.http.patch<{ script: Script; message: string }>(
          `${this.apiUrl()}/scripts/${id}`,
          updates
        )
      );

      // Refresh the scripts list
      await this.loadScripts();
      return updatedScript.script;
    } catch (error) {
      console.error('Error updating script:', error);
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async stopScript(scriptId: number): Promise<boolean> {
    return firstValueFrom(
      this.http.post<{ message: string }>(
        `${this.apiUrl()}/scripts/${scriptId}/kill`,
        {}
      )
    )
      .then(() => {
        return true;
      })
      .catch((error: any) => {
        return false;
      });
    /* try {
    } catch (error) {
      console.error('Error stopping script:', error);
      return false;
    } */
  }

  async deleteScript(id: number): Promise<boolean> {
    try {
      this.isLoading.set(true);
      await firstValueFrom(this.http.delete(`${this.apiUrl()}/scripts/${id}`));

      // Refresh the scripts list
      await this.loadScripts();
      return true;
    } catch (error) {
      console.error('Error deleting script:', error);
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteFile(id: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete<{ message: string }>(`${this.apiUrl()}/scripts/${id}`)
      );
      console.log('File deleted:', id);

      // Remove from local state
      const currentFiles = this.files();
      const updatedFiles = currentFiles.filter((file) => file.id !== id);
      this.files.set(updatedFiles);

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  async deleteScriptRun(runId: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiUrl()}/scripts/runs/${runId}`)
      );

      // Refresh script runs
      // await this.loadAllScriptRuns();
      return true;
    } catch (error) {
      console.error('Error deleting script run:', error);
      return false;
    }
  }

  // Helper methods for UI compatibility
  getScriptStatus(
    scriptId: number
  ): 'idle' | 'running' | 'completed' | 'error' {
    const latestRun = this.getLatestRun(scriptId);
    if (!latestRun) return 'idle';

    switch (latestRun.status) {
      case 'running':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'error';
      default:
        return 'idle';
    }
  }

  async getStats() {
    interface ScriptStats {
      overview: {
        totalScripts: number;
        totalRuns: number;
        recentRuns: number;
        currentlyRunning: number;
        successRate: number;
      };
      /* scriptsByType: scriptsByType.reduce((acc, item) => {
        acc[item.type] = parseInt(item.count);
        return acc;
      }, {}), */
      runsByStatus: {
        completed: number;
        failed: number;
      };
    }
    const stats = await firstValueFrom(
      this.http.get<{ message: string; stats: ScriptStats }>(
        `${this.apiUrl()}/scripts/stats/`
      )
    );
    console.log('stats', stats);
    return stats.stats;
  }

  getLatestRun(scriptId: number): ScriptRun | null {
    const latestRun = this.latestScriptRunMap().get(scriptId);
    return latestRun || null;
  }

  getRunProgress(runId: number): number {
    return this.currentRunProgress()[runId] || 0;
  }

  // Clean up socket connection when service is destroyed
  ngOnDestroy() {
    this.socketService.disconnect();
  }

  /* async updateScript(script: Script): Promise<void> {
    const response = await this.http
      .put<Script>(`${this.apiUrl}/scripts/${script.id}`, script)
      .toPromise();

    if (response) {
      this.scripts.update((scripts) =>
        scripts.map((s) => (s.id === script.id ? response : s))
      );
    }
  } */

  getScriptById(id: number): Script | undefined {
    return this.scripts().find((s) => s.id === id);
  }

  async getScriptWithContentById(id: number): Promise<Script | undefined> {
    const scriptContent = await firstValueFrom(
      this.http.get<{ script: Script; message: string }>(
        `${this.apiUrl()}/scripts/${id}/content`
      )
    );
    return scriptContent.script;
  }

  /**
   * Browse files at a given path using /files/list?path=...
   */
  async browseFiles(path: string = ''): Promise<FileInfo[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ items: FileInfo[]; message: string }>(
          `${this.apiUrl()}/scripts/files/list?path=${encodeURIComponent(path)}`
        )
      );
      console.log('response', response);
      return response.items;
    } catch (error) {
      console.error('Error browsing files:', error);
      return [];
    }
  }

  /**
   * Delete a file or folder by path using /files/delete?path=...
   * (Assumes backend supports this endpoint)
   */
  async deleteFileByPath(path: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete<{ message: string }>(
          `${this.apiUrl()}/scripts/files/?path=${encodeURIComponent(path)}`
        )
      );
      return true;
    } catch (error) {
      console.error('Error deleting file by path:', error);
      return false;
    }
  }

  // Expose the apiUrl signal for other parts of the app
  getApiUrlSignal() {
    return this.apiUrl;
  }
}
