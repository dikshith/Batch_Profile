// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ProfileData {
  cumTime: number;   // seconds
  calls: number;
  perCall: number;   // milliseconds
  totTime: number;   // seconds
}
interface FunctionProfile {
  id: number;
  name: string;
  filePath: string;
  isBuiltin: boolean;
  profiles: { [key: string]: ProfileData | null }; // profile_1, profile_2, ...
}
interface ComparisonSummary {
  totalFunctions: number;
  profilesCompared: number;
  significantDifferences?: number;
  performanceGain: string; // "+15.2%"
}
interface ComparisonResults {
  summary: ComparisonSummary;
  functions: FunctionProfile[];
}
interface ProfileSlot {
  file: File | null;
  name: string;
  status: 'empty' | 'uploaded' | 'processing' | 'ready';
}
interface PerformanceInsight {
  type: 'critical' | 'warning' | 'info';
  impact: string;
  function: string;
  description: string;
}

@Component({
  selector: 'app-root',
  //standalone: true,
 // imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'profile-comparison-tool';

  // State
  activeTab: 'upload' | 'comparison' | 'analysis' = 'upload';
  profileSlots: ProfileSlot[] = [
    { file: null, name: 'Profile 1', status: 'empty' },
    { file: null, name: 'Profile 2', status: 'empty' },
    { file: null, name: 'Profile 3', status: 'empty' }
  ];

  comparisonResults: ComparisonResults | null = null;
  isLoading = false;
  loadingMessage = '';
  showSettings = false;

  // Filters & sorting
  sortBy: 'cumTime' | 'calls' | 'perCall' | 'function' = 'cumTime';
  sortOrder: 'asc' | 'desc' = 'desc';
  filterThreshold = 0.001; // seconds

  // Settings
  displayPrecision = 3;
  showBuiltinMethods = true;
  highlightDifferences = true;

  // Selected row
  selectedFunction: FunctionProfile | null = null;

  ngOnInit(): void {}

  // Tabs
  setActiveTab(tab: 'upload' | 'comparison' | 'analysis') { this.activeTab = tab; }
  toggleSettings() { this.showSettings = !this.showSettings; }

  // File handling
  onFileSelected(event: Event, profileIndex: number) {
    const input = event.target as HTMLInputElement;
    const file = (input?.files && input.files[0]) || null;
    this.profileSlots[profileIndex].file = file;
    this.profileSlots[profileIndex].status = file ? 'uploaded' : 'empty';
  }
  removeProfile(profileIndex: number) {
    this.profileSlots[profileIndex].file = null;
    this.profileSlots[profileIndex].status = 'empty';
  }
  getUploadedProfiles(): ProfileSlot[] {
    return this.profileSlots.filter(slot => !!slot.file);
  }

  // Comparison (mocked)
  async runComparison() {
    this.isLoading = true;
    this.loadingMessage = 'Processing profile dumps...';
    try {
      await this.delay(500);
      this.comparisonResults = this.generateMockResults();
      this.loadingMessage = 'Generating comparison report...';
      await this.delay(300);
      this.activeTab = 'comparison';
    } catch (e) {
      console.error('Comparison failed:', e);
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  private generateMockResults(): ComparisonResults {
    return {
      summary: {
        totalFunctions: 156,
        profilesCompared: this.getUploadedProfiles().length,
        significantDifferences: 12,
        performanceGain: '+15.2%'
      },
      functions: [
        {
          id: 1,
          name: '176',
          filePath: 'D:\\dump2_comparison\\profile-comparison-tool\\backend\\test_profile_generator.py',
          isBuiltin: false,
          profiles: { profile_1: null, profile_2: null,
            profile_3: { cumTime: 667.846, calls: 1, perCall: 540358, totTime: 127.468 } }
        },
        {
          id: 2,
          name: '114',
          filePath: 'D:\\dump2_comparison\\profile-comparison-tool\\backend\\test_profile_generator.py',
          isBuiltin: false,
          profiles: { profile_1: null, profile_2: null,
            profile_3: { cumTime: 653.078, calls: 10, perCall: 275310, totTime: 2.753 } }
        },
        {
          id: 3,
          name: '<built-in method time.sleep>',
          filePath: '~:0',
          isBuiltin: true,
          profiles: {
            profile_1: null,
            profile_2: { cumTime: 0.19590, calls: 50, perCall: 3920, totTime: 0.19590 },
            profile_3: { cumTime: 651.468, calls: 37510, perCall: 17370, totTime: 651.468 }
          }
        },
        {
          id: 4,
          name: '124',
          filePath: 'D:\\dump2_comparison\\profile-comparison-tool\\backend\\test_profile_generator.py',
          isBuiltin: false,
          profiles: { profile_1: null, profile_2: null,
            profile_3: { cumTime: 12.675, calls: 10, perCall: 105530, totTime: 1.055 } }
        },
        {
          id: 5,
          name: '130',
          filePath: 'D:\\dump2_comparison\\profile-comparison-tool\\backend\\test_profile_generator.py',
          isBuiltin: false,
          profiles: { profile_1: null, profile_2: null,
            profile_3: { cumTime: 11.042, calls: 100000, perCall: 71.43, totTime: 7.143 } }
        },
        {
          id: 6,
          name: "<method 'random' of '_random.Random' objects>",
          filePath: '',
          isBuiltin: true,
          profiles: {
            profile_1: null,
            profile_2: { cumTime: 0.00833, calls: 50000, perCall: 0.166, totTime: 0.00833 },
            profile_3: { cumTime: 3.903, calls: 10010000, perCall: 0.39, totTime: 3.903 }
          }
        }
      ]
    };
  }

  // Filtering & sorting
  getFilteredFunctions(): FunctionProfile[] {
    if (!this.comparisonResults) return [];
    let fns = [...this.comparisonResults.functions];

    if (!this.showBuiltinMethods) fns = fns.filter(f => !f.isBuiltin);

    fns = fns.filter(f => Object.values(f.profiles)
      .some(p => p != null && (p as ProfileData).cumTime >= this.filterThreshold));

    fns.sort((a, b) => {
      let aValue: any, bValue: any;
      switch (this.sortBy) {
        case 'function': aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase(); break;
        case 'cumTime':  aValue = this.getMaxProfileValue(a, 'cumTime');  bValue = this.getMaxProfileValue(b, 'cumTime');  break;
        case 'calls':    aValue = this.getMaxProfileValue(a, 'calls');    bValue = this.getMaxProfileValue(b, 'calls');    break;
        case 'perCall':  aValue = this.getMaxProfileValue(a, 'perCall');  bValue = this.getMaxProfileValue(b, 'perCall');  break;
        default: return 0;
      }
      return this.sortOrder === 'asc'
        ? (aValue > bValue ? 1 : (aValue < bValue ? -1 : 0))
        : (aValue < bValue ? 1 : (aValue > bValue ? -1 : 0));
    });

    return fns;
  }
  private getMaxProfileValue(func: FunctionProfile, field: keyof ProfileData): number {
    const values = Object.values(func.profiles)
      .filter((p): p is ProfileData => p !== null)
      .map(p => p[field] as number);
    return Math.max(...values, 0);
  }

  sortResults() {}
  applyFilter() {}
  selectFunction(func: FunctionProfile) { this.selectedFunction = func; }

  // Formatting
  formatTime(seconds: number): string {
    if (!seconds || seconds === 0) return 'N/A';
    if (seconds >= 1) return `${seconds.toFixed(this.displayPrecision)}s`;
    if (seconds >= 0.001) return `${(seconds * 1000).toFixed(this.displayPrecision)}ms`;
    return `${(seconds * 1_000_000).toFixed(this.displayPrecision)}μs`;
  }
  formatCalls(calls: number): string {
    if (!calls || calls === 0) return 'N/A';
    return calls.toLocaleString();
  }
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  // Perf analysis
  getPerformanceClass(): string {
    const gain = this.comparisonResults?.summary?.performanceGain || '';
    if (gain.includes('+')) return 'positive';
    if (gain.includes('-')) return 'negative';
    return '';
  }
  getPerformanceInsights(): PerformanceInsight[] {
    if (!this.comparisonResults) return [];
    return [
      { type: 'critical', impact: 'High', function: 'time.sleep',
        description: 'Significant increase in sleep calls detected. Profile 3 shows 37,510 calls vs 50 in Profile 2.' },
      { type: 'warning', impact: 'Medium', function: 'random method',
        description: 'Random number generation calls increased dramatically from 50,000 to 10,010,000.' },
      { type: 'info', impact: 'Low', function: 'Function 176',
        description: 'New function execution detected in Profile 3 only.' }
    ];
  }

  // Export
  exportResults() {
    if (!this.comparisonResults) return;
    const data = JSON.stringify(this.comparisonResults, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'profile-comparison-results.json'; a.click();
    window.URL.revokeObjectURL(url);
  }

  // Utils
  private delay(ms: number): Promise<void> { return new Promise(res => setTimeout(res, ms)); }
  getProfileData(func: FunctionProfile, idx: number): ProfileData | null {
    return func.profiles[`profile_${idx + 1}`] || null;
  }
}