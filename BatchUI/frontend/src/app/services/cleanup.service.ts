import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export interface CleanupRequest {
  days: number;
  status: string | null;
  confirm?: boolean;
}

export interface CleanupSummary {
  totalRuns: number;
  cutoffDate: string;
  runsByStatus: { [key: string]: number };
  runsByScript: { [key: string]: number };
  logFilesToDelete: number;
}

export interface CleanupRun {
  id: number;
  scriptName: string;
  status: string;
  startTime: string;
  logFile: string;
  hasLogFile: boolean;
}

export interface DryRunResponse {
  message: string;
  dryRun: boolean;
  summary: CleanupSummary;
  runs: CleanupRun[];
}

export interface CleanupResponse {
  message: string;
  dryRun: boolean;
  deletedRuns: number;
  deletedLogFiles: number;
  cutoffDate: string;
  errors: string[];
  totalProcessed: number;
}

export interface SchedulerStatus {
  isRunning: boolean;
  config: {
    enabled: boolean;
    interval: number;
    days: number;
    status: string | null;
    dryRun: boolean;
  };
  nextRun: string;
  lastRun: string;
}

@Injectable({
  providedIn: 'root',
})
export class CleanupService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Use AuthService's API URL signal
  private get apiUrl() {
    return this.authService.getApiUrlSignal();
  }

  constructor() {
    console.log('apiUrl', this.apiUrl);
  }

  init() {
    console.log('apiUrl', this.apiUrl);
  }

  async performCleanupDryRun(request: CleanupRequest): Promise<DryRunResponse> {
    return await firstValueFrom(
      this.http.post<DryRunResponse>(
        `${this.apiUrl()}/scripts/runs/cleanup/dry-run`,
        request
      )
    );
  }

  async performCleanup(request: CleanupRequest): Promise<CleanupResponse> {
    return await firstValueFrom(
      this.http.post<CleanupResponse>(
        `${this.apiUrl()}/scripts/runs/cleanup`,
        request
      )
    );
  }

  async getSchedulerStatus(): Promise<SchedulerStatus> {
    const res = await firstValueFrom(
      this.http.get<{ message: string; status: SchedulerStatus }>(
        `${this.apiUrl()}/scripts/runs/scheduler/status`
      )
    );
    return res.status;
  }

  async startScheduler(config: any): Promise<any> {
    return await firstValueFrom(
      this.http.post(`${this.apiUrl()}/scripts/runs/scheduler/start`, config)
    );
  }

  async stopScheduler(): Promise<any> {
    return await firstValueFrom(
      this.http.post(`${this.apiUrl()}/scripts/runs/scheduler/stop`, {})
    );
  }

  async updateSchedulerConfig(config: any): Promise<any> {
    return await firstValueFrom(
      this.http.put(`${this.apiUrl()}/scripts/runs/scheduler/config`, config)
    );
  }
}
