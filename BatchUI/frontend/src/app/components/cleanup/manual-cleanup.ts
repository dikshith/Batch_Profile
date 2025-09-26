import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CleanupService,
  CleanupRequest,
  DryRunResponse,
  CleanupResponse,
} from '../../services/cleanup.service';

@Component({
  selector: 'app-manual-cleanup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manual-cleanup.html',
  styleUrls: ['./cleanup.scss'],
})
export class ManualCleanupComponent {
  private cleanupService = inject(CleanupService);

  // Form data
  days = signal<number>(30);
  status = signal<string>('all');
  confirm = signal<boolean>(false);

  // State
  isLoading = signal<boolean>(false);
  dryRunResults = signal<DryRunResponse | null>(null);
  cleanupResults = signal<CleanupResponse | null>(null);
  error = signal<string | null>(null);

  // Available statuses
  statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ];

  // Helper method for template
  Object = Object;

  async performDryRun() {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      this.dryRunResults.set(null);

      const response = await this.cleanupService.performCleanupDryRun({
        days: this.days(),
        status: this.status() === 'all' ? null : this.status(),
      });

      this.dryRunResults.set(response);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to perform dry run');
    } finally {
      this.isLoading.set(false);
    }
  }

  async performCleanup() {
    if (!this.confirm()) {
      this.error.set('Please confirm the cleanup operation');
      return;
    }

    try {
      this.isLoading.set(true);
      this.error.set(null);
      this.cleanupResults.set(null);

      const response = await this.cleanupService.performCleanup({
        days: this.days(),
        status: this.status() === 'all' ? null : this.status(),
        confirm: this.confirm(),
      });

      this.cleanupResults.set(response);
      // Optionally refresh runs data after cleanup
    } catch (err: any) {
      this.error.set(err.message || 'Failed to perform cleanup');
    } finally {
      this.isLoading.set(false);
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'failed':
        return 'badge-error';
      case 'running':
        return 'badge-warning';
      default:
        return 'badge-secondary';
    }
  }

  resetResults() {
    this.dryRunResults.set(null);
    this.cleanupResults.set(null);
    this.error.set(null);
  }
}
