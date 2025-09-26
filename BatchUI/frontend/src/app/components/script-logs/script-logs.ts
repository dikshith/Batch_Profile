import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  ScriptService,
  ScriptRun,
  Script,
} from '../../services/script-service';
import { SocketService } from '../../services/socket.service';
import { Subscription, tap } from 'rxjs';

import { Router } from '@angular/router';
import { ScriptRunService } from '../../services/script-run.service';

@Component({
  selector: 'app-script-logs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './script-logs.html',
  styleUrl: './script-logs.scss',
})
export class ScriptLogs implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private scriptService = inject(ScriptService);
  private scriptRunService = inject(ScriptRunService);
  private socketService = inject(SocketService);
  private subscriptions: Subscription[] = [];

  script: Script | null = null;
  currentRun = signal<ScriptRun | null>(null);
  logs = signal('');
  error: string = '';

  async ngOnInit() {
    this.subscriptions.push(
      this.socketService.getLogUpdates().subscribe((update) => {
        console.log('log update', update);
        if (update && this.currentRun()?.id === update.runId) {
          this.logs.set(this.logs() + update.content);

          console.log('logs', this.logs());
        }
      }),

      // Subscribe to run updates
      this.socketService.getRunUpdates().subscribe((update) => {
        if (
          update &&
          this.currentRun() &&
          update.runId === this.currentRun()?.id
        ) {
          let temp = this.currentRun();
          if (temp) {
            temp.id = update.runId;
            // temp.scriptId = this.currentRun()?.scriptId || 0;
            temp.status = update.status as 'running' | 'completed' | 'failed';
            // temp.output = update.output || this.currentRun()?.output;
            temp.endTime = update.endTime || this.currentRun()?.endTime;
          }
          this.currentRun.set(temp);
          console.log('updated current run ', this.currentRun());
          if (update.error) {
            this.error = update.error;
          }
        }
      }),

      this.route.queryParams.subscribe(async (params) => {
        console.log('query params', params);
        const runId = Number(params['runId']);
        this.logs.set('');
        // console.log('empty logs', this.logs());
        this.error = '';
        this.currentRun.set(null);
        this.script = null;

        // Subscribe to log updates
        // Reset state and fetch data based on query params
        await this.loadData(runId);
      })
    );
  }

  async loadData(runId: number) {
    // this.subscriptions.push(
    // this.route.queryParams.subscribe(async (params) => {
    this.currentRun.set(await this.scriptService.getScriptRun(runId));
    

    console.log('current run', this.currentRun());
    if (this.currentRun()) {
      if (this.currentRun()?.status === 'running') {
        this.socketService.watchLogs(this.currentRun()?.id || 0);
      }
      this.logs.set(this.currentRun()?.content || '');
      this.error = this.currentRun()?.error || '';
    }

    // })
    // );
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  }

  formatDuration(startTime: string, endTime?: string): string {
    if (!endTime) {
      const duration = Date.now() - new Date(startTime).getTime();
      return this.formatDurationMs(duration);
    }
    const duration =
      new Date(endTime).getTime() - new Date(startTime).getTime();
    return this.formatDurationMs(duration);
  }

  private formatDurationMs(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.socketService.stopWatching();
  }
}
