import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ScriptAdd } from '../script-add/script-add';
import { ScriptService, Script } from '../../services/script-service';

import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ScriptRunService } from '../../services/script-run.service';
import { FileBrowserComponent } from '../file-browser/file-browser';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-script-list',
  imports: [
    CommonModule,
    ScriptAdd,
    FormsModule,
    RouterModule,
    FileBrowserComponent,
  ],
  templateUrl: './script-list.html',
  styleUrl: './script-list.scss',
})
export class ScriptList implements OnDestroy {
  private scriptService = inject(ScriptService);
  private router = inject(Router);
  private socketService = inject(SocketService);
  scripts = this.scriptService.getScripts();
  pagination = this.scriptService.getPagination();
  isLoading = this.scriptService.getIsLoading();

  scriptRunService = inject(ScriptRunService);

  showAddModal = signal<boolean>(false);
  activeTab = 'scripts'; // 'scripts' or 'files'

  selectedScriptIds = new Set<number>();
  selectAll = false;

  activatedRoute = inject(ActivatedRoute);

  fileBrowserVisible = false;

  constructor() {
    this.scriptService.init();
    this.socketService.init();
    this.scriptService.loadScriptsWithPagination(1);
    this.activatedRoute.queryParams.subscribe((queries) => {
      console.log(queries);
    });
  }

  openAddModal() {
    console.log('open add modal');
    this.showAddModal.set(true);
  }

  closeAddModal() {
    console.log('Received close event');
    this.showAddModal.set(false);
  }

  async viewScriptLogs(scriptId: number) {
    const latestRun = await this.scriptRunService.getLatestRunForScript(
      scriptId
    );
    if (latestRun) {
      this.router.navigate(['/logs'], { queryParams: { runId: latestRun.id } });
    }
  }

  editScript(scriptId: number) {
    this.router.navigate(['/scripts', scriptId, 'edit']);
  }

  toggleSelectAll() {
    if (this.selectAll) {
      this.selectedScriptIds.clear();
    } else {
      this.scripts().forEach((script) => {
        if (this.getScriptStatus(script.id) !== 'running') {
          this.selectedScriptIds.add(script.id);
        }
      });
    }
    this.selectAll = !this.selectAll;
  }

  toggleScriptSelection(scriptId: number) {
    if (this.selectedScriptIds.has(scriptId)) {
      this.selectedScriptIds.delete(scriptId);
    } else {
      this.selectedScriptIds.add(scriptId);
    }
    this.updateSelectAllState();
  }

  updateSelectAllState() {
    const selectableScripts = this.scripts().filter(
      (script) => this.getScriptStatus(script.id) !== 'running'
    );
    this.selectAll =
      selectableScripts.length > 0 &&
      selectableScripts.every((script) =>
        this.selectedScriptIds.has(script.id)
      );
  }

  async runSelectedScripts() {
    const selectedIds = Array.from(this.selectedScriptIds);

    for (const scriptId of selectedIds) {
      try {
        await this.scriptService.runScript(scriptId);
      } catch (error) {
        console.error(`Error running script ${scriptId}:`, error);
      }
    }

    this.selectedScriptIds.clear();
    this.selectAll = false;
  }

  async deleteSelectedScripts() {
    const selectedIds = Array.from(this.selectedScriptIds);
    const scriptNames = selectedIds
      .map((id) => this.scripts().find((s) => s.id === id)?.name)
      .filter(Boolean);

    if (
      confirm(
        `Are you sure you want to delete ${
          selectedIds.length
        } script(s)?\n\n${scriptNames.join(', ')}`
      )
    ) {
      for (const scriptId of selectedIds) {
        try {
          await this.scriptService.deleteScript(scriptId);
        } catch (error) {
          console.error(`Error deleting script ${scriptId}:`, error);
        }
      }

      this.selectedScriptIds.clear();
      this.selectAll = false;
    }
  }

  async runScript(scriptId: number) {
    try {
      await this.scriptService.runScript(scriptId);
    } catch (error) {
      console.error('Error running script:', error);
    }
  }

  async deleteScript(script: Script) {
    if (confirm(`Are you sure you want to delete "${script.name}"?`)) {
      try {
        await this.scriptService.deleteScript(script.id);
      } catch (error) {
        console.error('Error deleting script:', error);
      }
    }
  }

  async stopScript(scriptId: number) {
    await this.scriptService.stopScript(scriptId);

    // this.scriptService.loadAllScriptRuns();
  }

  getScriptStatus(scriptId: number) {
    return this.scriptService.getScriptStatus(scriptId);
  }

  async getLatestRun(scriptId: number) {
    return await this.scriptRunService.getLatestRunForScript(scriptId);
    //return this.scriptService.getLatestRun(scriptId);
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

  formatLastRun(dateString?: string): string {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0)
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMinutes > 0)
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  getScriptProgress(scriptId: number): number {
    const latestRun = this.scriptService.getLatestRun(scriptId);
    if (latestRun && latestRun.status === 'running') {
      return latestRun.progress || 0;
    }
    return 0;

    return 0;
  }

  ngOnDestroy() {
    // Clean up any subscriptions if needed
  }

  setActiveTab(tab: 'scripts' | 'files') {
    this.activeTab = tab;
  }

  setPage(page: number) {
    this.scriptService.setPage(page);
  }
}
