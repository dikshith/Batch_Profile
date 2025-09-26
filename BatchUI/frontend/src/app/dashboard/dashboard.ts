import { Component, inject, computed, signal } from '@angular/core';
import { ScriptList } from '../components/script-list/script-list';
import { ScriptService } from '../services/script-service';
import { ScriptRunService } from '../services/script-run.service';

@Component({
  selector: 'app-dashboard',
  imports: [ScriptList],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private scriptService = inject(ScriptService);

  // scripts = this.scriptService.getScripts();
  // scriptRunService = inject(ScriptRunService)

  runningScripts = signal<number>(0);

  failedScripts = signal<number>(0);

  completedToday = signal<number>(0);

  scriptsCount = signal<number>(0);

  constructor() {
    this.scriptService.getStats().then((stats) => {
      this.runningScripts.set(stats.overview.currentlyRunning);
      this.completedToday.set(stats.overview.recentRuns);
      this.scriptsCount.set(stats.overview.totalScripts);
      this.failedScripts.set(stats.runsByStatus.failed);
    });
  }
}
