import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CleanupService,
  SchedulerStatus,
} from '../../services/cleanup.service';

@Component({
  selector: 'app-automated-cleanup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './automated-cleanup.html',
  styleUrls: ['./cleanup.scss'],
})
export class AutomatedCleanupComponent implements OnInit {
  private cleanupService = inject(CleanupService);

  // Scheduler
  schedulerStatus = signal<SchedulerStatus | null>(null);
  schedulerLoading = signal<boolean>(false);
  schedulerError = signal<string | null>(null);
  schedulerConfig = signal<any>({
    enabled: true,
    interval: 86400000,
    days: 30,
    status: null,
    dryRun: false,
  });
  intervalHours: number = 24;

  async ngOnInit() {
    await this.loadSchedulerStatus();
    this.intervalHours = this.schedulerConfig().interval / 3600000;
  }

  async loadSchedulerStatus() {
    try {
      this.schedulerLoading.set(true);
      this.schedulerError.set(null);
      const status = await this.cleanupService.getSchedulerStatus();
      this.schedulerStatus.set(status);
      this.schedulerConfig.set({ ...status.config });
      this.intervalHours = status.config.interval / 3600000;

      console.log('intervalHours', this.intervalHours);
    } catch (err: any) {
      this.schedulerError.set(err.message || 'Failed to load scheduler status');
    } finally {
      this.schedulerLoading.set(false);
    }
  }

  async startScheduler() {
    try {
      this.schedulerLoading.set(true);
      this.schedulerError.set(null);
      await this.cleanupService.startScheduler(this.schedulerConfig());
      await this.loadSchedulerStatus();
    } catch (err: any) {
      this.schedulerError.set(err.message || 'Failed to start scheduler');
    } finally {
      this.schedulerLoading.set(false);
    }
  }

  async stopScheduler() {
    try {
      this.schedulerLoading.set(true);
      this.schedulerError.set(null);
      await this.cleanupService.stopScheduler();
      await this.loadSchedulerStatus();
    } catch (err: any) {
      this.schedulerError.set(err.message || 'Failed to stop scheduler');
    } finally {
      this.schedulerLoading.set(false);
    }
  }

  async updateSchedulerConfig() {
    try {
      this.schedulerLoading.set(true);
      this.schedulerError.set(null);
      this.schedulerConfig.set({
        ...this.schedulerConfig(),
        interval: this.intervalHours * 3600000,
      });
      await this.cleanupService.updateSchedulerConfig(this.schedulerConfig());
      await this.loadSchedulerStatus();
    } catch (err: any) {
      this.schedulerError.set(
        err.message || 'Failed to update scheduler config'
      );
    } finally {
      this.schedulerLoading.set(false);
    }
  }

  formatDateWithHour(dateString: string): string {
    console.log('dateString', dateString);
    return new Date(dateString).toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
