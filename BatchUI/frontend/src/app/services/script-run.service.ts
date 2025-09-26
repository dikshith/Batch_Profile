import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ScriptRunResponse, Pagination } from './script-service';

export interface RunStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
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

export interface RunScriptRequest {
  scriptId: number;
  executionPath?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ScriptRunService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Use AuthService's API URL signal
  private get apiUrl() {
    return this.authService.getApiUrlSignal();
  }

  private totalPages = signal<number>(0);

  constructor() {}

  init() {}

  async getScriptRunsWithOptions(options: {
    page: number;
    pageSize: number;
    sort: { field: string; direction: 'asc' | 'desc' };
    filter: {
      status: string;
      scriptId: number;
      dateFrom: string;
      dateTo: string;
    };
  }): Promise<{ scriptRuns: ScriptRun[]; pagination: Pagination }> {
    const { page, pageSize, sort, filter } = options;
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page.toString());
    if (pageSize) queryParams.append('pageSize', pageSize.toString());
    if (sort) {
      if (sort.field === 'startTime') {
        queryParams.append('sort', 'createdAt');
      } else {
        queryParams.append('sort', sort.field);
      }
      queryParams.append('direction', sort.direction);
    }
    if (filter.status) {
      queryParams.append('status', filter.status);
    }
    if (filter.scriptId) {
      queryParams.append('scriptId', filter.scriptId.toString());
    }
    if (filter.dateFrom) {
      queryParams.append('dateFrom', filter.dateFrom);
    }
    if (filter.dateTo) {
      queryParams.append('dateTo', filter.dateTo);
    }
    const filteredRuns = await firstValueFrom<ScriptRunResponse>(
      this.http.get<ScriptRunResponse>(
        `${this.apiUrl()}/scripts/runs/all?${queryParams.toString()}`
      )
    );
    return filteredRuns;
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

  async getLatestRunForScript(scriptId: number): Promise<ScriptRun | null> {
    const runs = await firstValueFrom(
      this.http.get<{ scriptRuns: ScriptRun[]; message: string }>(
        `${this.apiUrl()}/scripts/${scriptId}/runs?limit=1&sortOrder=DESC&sortBy=createdAt`
      )
    );
    return runs.scriptRuns[0] || null;
  }

  async getRunStats(): Promise<RunStats> {
    const response = await firstValueFrom(
      this.http.get<RunStats>(`${this.apiUrl()}/scripts/runs/stats`)
    );
    return response;
  }

  async getAllScriptRuns() {
    const response = await firstValueFrom(
      this.http.get<{ scriptRuns: ScriptRun[]; message: string }>(
        `${this.apiUrl()}/scripts/runs/all`
      )
    );
    return response.scriptRuns;
  }

  async runScript(request: RunScriptRequest) {
    const run = await firstValueFrom(
      this.http.post<ScriptRun>(`${this.apiUrl()}/scripts/run`, request)
    );
    return run;
  }
}
