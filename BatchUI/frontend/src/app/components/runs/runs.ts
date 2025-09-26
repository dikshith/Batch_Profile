import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ScriptService, ScriptRun } from '../../services/script-service';
import { RunStats, ScriptRunService } from '../../services/script-run.service';

interface FilterOptions {
  status: string;
  scriptId: string;
  dateFrom: string;
  dateTo: string;
}

interface SortOptions {
  field: 'startTime' | 'duration' | 'status' | 'scriptName';
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-runs',
  imports: [CommonModule, FormsModule],
  templateUrl: './runs.html',
  styleUrl: './runs.scss',
})
export class Runs implements OnInit {
  private scriptService = inject(ScriptService);
  private scriptRunService = inject(ScriptRunService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Make Math available in template
  Math = Math;

  allRuns = signal<ScriptRun[]>([]);
  scripts = this.scriptService.getScripts();
  isLoading = this.scriptService.getIsLoading();

  // Filter and sort signals
  filters = signal<FilterOptions>({
    status: '',
    scriptId: '',
    dateFrom: '',
    dateTo: '',
  });

  sort = signal<SortOptions>({
    field: 'startTime',
    direction: 'desc',
  });

  page = signal(1);
  pageSize = signal(10);

  // Computed filtered and sorted runs
  filteredRuns = signal<ScriptRun[]>([]);
  filteredRunsComputed = computed(() => {
    let runs = [...this.allRuns()];
    const filterValues = this.filters();

    // Apply status filter
    if (filterValues.status) {
      runs = runs.filter((run) => run.status === filterValues.status);
    }

    // Apply script filter
    if (filterValues.scriptId) {
      runs = runs.filter(
        (run) => run.scriptId.toString() === filterValues.scriptId
      );
    }

    // Apply date filters
    if (filterValues.dateFrom) {
      const fromDate = new Date(filterValues.dateFrom);
      runs = runs.filter((run) => new Date(run.startTime) >= fromDate);
    }

    if (filterValues.dateTo) {
      const toDate = new Date(filterValues.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      runs = runs.filter((run) => new Date(run.startTime) <= toDate);
    }

    // Apply sorting
    const sortOptions = this.sort();
    runs.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortOptions.field) {
        case 'startTime':
          aValue = new Date(a.startTime);
          bValue = new Date(b.startTime);
          break;
        case 'duration':
          aValue = a.duration || 0;
          bValue = b.duration || 0;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'scriptName':
          aValue = this.getScriptName(a.scriptId);
          bValue = this.getScriptName(b.scriptId);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOptions.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOptions.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return runs;
  });

  // Computed pagination
  runStats = signal<RunStats>({
    total: 0,
    completed: 0,
    failed: 0,
    running: 0,
  });
  totalRuns = computed(() => this.allRuns().length);
  totalPages = this.scriptService.getTotalPages();

  paginatedRuns = signal<ScriptRun[]>([]);

  async ngOnInit() {
    console.log('totalPages', this.totalPages());
    await this.scriptService.loadScripts();
    await this.loadRunStats();

    // Initial load with current filters
    await this.loadRunsWithFilters();

    // Subscribe to query params changes
    this.route.queryParams.subscribe(async (params) => {
      this.filters.update((current) => ({
        ...current,
        status: params['status'] || '',
        scriptId: params['scriptId'] || '',
        dateFrom: params['dateFrom'] || '',
        dateTo: params['dateTo'] || '',
      }));

      if (params['sortBy']) {
        this.sort.update((current) => ({
          ...current,
          field: params['sortBy'] || 'startTime',
          direction: params['sortDir'] || 'desc',
        }));
      }

      if (params['page']) {
        this.page.set(parseInt(params['page']) || 1);
      }

      if (params['pageSize']) {
        this.pageSize.set(parseInt(params['pageSize']) || 10);
      }

      // Reload runs when filters change
      await this.loadRunsWithFilters();
    });
  }

  private async loadRunStats() {
    const stats = await this.scriptRunService.getRunStats();
    console.log('stats', stats);
    this.runStats.set(stats);
  }

  private async loadRunsWithFilters() {
    const runs = await this.scriptRunService.getScriptRunsWithOptions({
      page: this.page(),
      pageSize: this.pageSize(),
      sort: this.sort(),
      filter: {
        status: this.filters().status,
        scriptId: parseInt(this.filters().scriptId) || 0,
        dateFrom: this.filters().dateFrom,
        dateTo: this.filters().dateTo,
      },
    });
    this.allRuns.set(runs.scriptRuns);
    this.paginatedRuns.set(runs.scriptRuns);
    this.totalPages.set(runs.pagination.totalPages);
  }

  goToScriptLogs(runId: number) {
    this.router.navigate([`/logs`], {
      queryParams: { runId },
    });
  }

  updateFilters() {
    this.page.set(1); // Reset to first page when filtering
    this.updateUrlParams();
  }

  updateSort(field: SortOptions['field']) {
    const currentSort = this.sort();
    const newDirection =
      currentSort.field === field && currentSort.direction === 'asc'
        ? 'desc'
        : 'asc';

    this.sort.set({ field, direction: newDirection });
    this.updateUrlParams();
  }

  async goToPage(pageNum: number) {
    if (pageNum >= 1 && pageNum <= this.totalPages()) {
      this.page.set(pageNum);
      this.updateUrlParams();
      await this.loadRunsWithFilters();
    }
  }

  goToNextPage() {
    this.goToPage(this.page() + 1);
  }

  goToPreviousPage() {
    this.goToPage(this.page() - 1);
  }

  changePageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
    this.updateUrlParams();
    this.loadRunsWithFilters();
  }

  clearFilters() {
    this.filters.set({
      status: '',
      scriptId: '',
      dateFrom: '',
      dateTo: '',
    });
    this.page.set(1);
    this.updateUrlParams();
    this.loadRunsWithFilters();
  }

  private updateUrlParams() {
    const params: any = {};
    const filterValues = this.filters();
    const sortValues = this.sort();

    // Add filter params
    if (filterValues.status) params.status = filterValues.status;
    if (filterValues.scriptId) params.scriptId = filterValues.scriptId;
    if (filterValues.dateFrom) params.dateFrom = filterValues.dateFrom;
    if (filterValues.dateTo) params.dateTo = filterValues.dateTo;

    // Add sort params
    if (sortValues.field !== 'startTime' || sortValues.direction !== 'desc') {
      params.sortBy = sortValues.field;
      params.sortDir = sortValues.direction;
    }

    // Add pagination params
    if (this.page() > 1) params.page = this.page();
    if (this.pageSize() !== 10) params.pageSize = this.pageSize();

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'replace',
    });
  }

  getScriptName(scriptId: number): string {
    return (
      this.scripts().find((s) => s.id === scriptId)?.name ||
      `Script ${scriptId}`
    );
  }

  formatDuration(ms?: number): string {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  getSortIcon(field: SortOptions['field']): string {
    const currentSort = this.sort();
    if (currentSort.field !== field) return '↕️';
    return currentSort.direction === 'asc' ? '↑' : '↓';
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'running':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⏸️';
    }
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.page();
    const pages: number[] = [];

    // Show up to 5 page numbers around current page
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }
}
