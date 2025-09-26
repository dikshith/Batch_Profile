import { inject, Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

export interface LogUpdate {
  runId: number;
  content: string;
}

export interface RunUpdate {
  runId: number;
  status: string;
  output?: string;
  error?: string;
  progress?: number;
  endTime?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;
  private currentRunId: number | null = null;
  private logUpdates = new BehaviorSubject<LogUpdate | null>(null);
  private runUpdates = new BehaviorSubject<RunUpdate | null>(null);

  public apiUrl = signal<string>('');

  constructor(private authService: AuthService) {
    // Listen for logout events from AuthService
    AuthService.getLogoutObservable().subscribe(() => {
      this.disconnect();
    });
  }

  private setupSocketListeners() {
    this.socket?.on('log-update', (update: LogUpdate) => {
      this.logUpdates.next(update);
    });

    this.socket?.on('run-update', (update: RunUpdate) => {
      console.log('run-update', update);
      this.runUpdates.next(update);
    });

    this.socket?.on('progress-update', ({ runId, progress }) => {
      console.log('progress-update', runId, progress);
      this.runUpdates.next({ runId, status: 'running', progress });
    });

    this.socket?.on('run-complete', ({ runId, status, endTime }) => {
      console.log('run-complete', runId, status, endTime);
      this.runUpdates.next({ runId, status, endTime });
    });

    this.socket?.on('run-error', ({ runId, error }) => {
      this.runUpdates.next({ runId, status: 'failed', error });
    });
  }

  init() {
    this.apiUrl = this.authService.getApiUrlSignal();
    console.log('apiUrl', this.apiUrl);
    this.socket = io(this.apiUrl(), {
      transports: ['websocket'],
    });
    this.setupSocketListeners();
  }

  watchScriptRun(runId: number) {
    if (this.currentRunId) {
      this.stopWatching();
    }

    this.currentRunId = runId;
    console.log('watchScriptRun', runId);
    this.socket?.emit('join-run', runId);
    // this.socket.emit('watch-logs', runId);
  }

  watchLogs(runId: number) {
    this.socket?.emit('watch-logs', runId);
  }

  stopWatching() {
    this.socket?.emit('stop-watching');
    this.currentRunId = null;
  }

  getLogUpdates() {
    return this.logUpdates.asObservable();
  }

  getRunUpdates() {
    return this.runUpdates.asObservable();
  }

  disconnect() {
    console.log('disconnecting socket');
    if (this.socket) {
      this.stopWatching();
      this.socket.disconnect();
    }
  }
}
