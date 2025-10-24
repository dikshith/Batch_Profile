import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PythonProfileService } from '../../services/python-profile.service';
import { finalize } from 'rxjs/operators';

interface ProfileData {
  cumulative_time: number;   // seconds
  calls: number;
  per_call: number;   // seconds
  total_time: number;   // seconds
  name?: string;
  filename?: string;
  line_number?: number;
  function_name?: string;
  is_builtin?: boolean;
  is_stdlib?: boolean;
  is_third_party?: boolean;
  category?: 'builtin' | 'stdlib' | 'third_party' | 'user';
}
interface FunctionProfile {
  id: number;
  name: string;
  filePath: string;
  isBuiltin: boolean;
  isStdlib: boolean;
  isThirdParty: boolean;
  category: 'builtin' | 'stdlib' | 'third_party' | 'user';
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
  selector: 'app-python-profile',
  templateUrl: './python-profile.html',
  styleUrls: ['./python-profile.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class PythonProfileComponent implements OnInit {
  title = 'profile-comparison-tool';

  // State
  activeTab: 'upload' | 'comparison' | 'analysis' = 'upload';
  profileSlots: ProfileSlot[] = [
    { file: null, name: 'Profile 1', status: 'empty' },
    { file: null, name: 'Profile 2', status: 'empty' },
    { file: null, name: 'Profile 3', status: 'empty' }
  ];

  comparisonResults = signal<ComparisonResults | null>(null);
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
  showStdlibMethods = true;
  showThirdPartyMethods = true;
  showUserMethods = true;
  highlightDifferences = true;

  // Selected row
  selectedFunction: FunctionProfile | null = null;

  constructor(private profileService: PythonProfileService) {}

  ngOnInit(): void {
    // Check health and load any existing profiles
    this.profileService.checkHealth().subscribe(
      health => console.log('Server health:', health),
      error => console.error('Health check failed:', error)
    );

    this.loadExistingProfiles();
  }

  private loadExistingProfiles(): void {
    this.isLoading = true;
    this.loadingMessage = 'Loading existing profiles...';
    
    this.profileService.getProfiles().pipe(
      finalize(() => {
        this.isLoading = false;
        this.loadingMessage = '';
      })
    ).subscribe({
      next: (response: any) => {
        if (response.profiles && Array.isArray(response.profiles)) {
          response.profiles.forEach((profile: any, index: number) => {
            if (index < this.profileSlots.length) {
              this.profileSlots[index] = {
                file: new File([], profile.filename),
                name: profile.filename,
                status: 'ready'
              };
            }
          });

          // If we have at least 2 profiles, run comparison
          if (response.profiles.length >= 2) {
            this.runComparison();
          }
        }
      },
      error: (error: any) => console.error('Failed to load profiles:', error)
    });
  }
  // Tabs
  public setActiveTab(tab: 'upload' | 'comparison' | 'analysis'): void {
    this.activeTab = tab;
  }

  public toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  // File handling
  public onFileSelected(event: Event, profileIndex: number): void {
    const input = event.target as HTMLInputElement;
    const file = (input?.files && input.files[0]) || null;
    if (file) {
      this.profileSlots[profileIndex].status = 'processing';
      this.profileService.uploadProfile(file, profileIndex + 1).pipe(
        finalize(() => {
          if (this.profileSlots[profileIndex].status === 'processing') {
            this.profileSlots[profileIndex].status = 'empty';
          }
        })
      ).subscribe({
        next: (response: any) => {
          this.profileSlots[profileIndex].file = file;
          this.profileSlots[profileIndex].name = file.name;
          this.profileSlots[profileIndex].status = 'ready';
        },
        error: (error: any) => {
          console.error('Upload failed:', error);
          this.profileSlots[profileIndex].file = null;
          this.profileSlots[profileIndex].status = 'empty';
        }
      });
    }
  }

  public removeProfile(profileIndex: number): void {
    this.profileSlots[profileIndex].file = null;
    this.profileSlots[profileIndex].status = 'empty';
    // Optionally clear on server
    this.profileService.clearProfiles().subscribe({
      next: () => console.log('Profile cleared'),
      error: (error: any) => console.error('Failed to clear profile:', error)
    });
  }

  public getUploadedProfiles(): ProfileSlot[] {
    return this.profileSlots.filter(slot => !!slot.file);
  }

  public runComparison(): void {
    this.isLoading = true;
    this.loadingMessage = 'Processing profile dumps...';
    
    this.profileService.compareProfiles().pipe(
      finalize(() => {
        this.isLoading = false;
        this.loadingMessage = '';
      })
    ).subscribe({
      next: (response: any) => {
        console.log("comp : ", response);
        // Transform the response into our ComparisonResults format
        this.comparisonResults.set({
          summary: {
            totalFunctions: response.profiles.reduce((sum: number, p: any) => sum + p.function_count, 0),
            profilesCompared: response.profiles.length,
            significantDifferences: (
              (response.comparison.unique_functions.profile_1?.length || 0) +
              (response.comparison.unique_functions.profile_2?.length || 0)
            ),
            performanceGain: this.calculatePerformanceGain(response.comparison.performance_metrics)
          },
          functions: this.transformFunctions(response)
        });
        this.activeTab = 'comparison';
        console.log("comp results : ", this.comparisonResults());
      },
      error: (error: any) => {
        console.error('Comparison failed:', error);
        this.loadingMessage = 'Comparison failed. Please try again.';
      }
    });
  }

  private calculatePerformanceGain(metrics: any): string {
    if (metrics.speedup_factor > 1) {
      return `+${((metrics.speedup_factor - 1) * 100).toFixed(1)}%`;
    } else if (metrics.speedup_factor < 1) {
      return `-${((1 - metrics.speedup_factor) * 100).toFixed(1)}%`;
    }
    return '0%';
  }

  private transformFunctions(response: any): FunctionProfile[] {
    const functions: FunctionProfile[] = [];
    let id = 0;

    // Add common functions
    if (response.comparison.common_functions) {
      response.comparison.common_functions.forEach((func: any) => {
        const categorization = this.categorizeFunction(func.name);
        functions.push({
          id: id++,
          name: func.name,
          filePath: func.name.split('(')[0].split(':')[0],
          ...categorization,
          profiles: func.profiles
        });
      });
    }

    // Add unique functions from profile 1
    if (response.comparison.unique_functions.profile_1) {
      response.comparison.unique_functions.profile_1.forEach((func: any) => {
        const data = func.data;
        const categorization = this.categorizeFunction(func.name);
        functions.push({
          id: id++,
          name: func.name,
          filePath: func.name.split('(')[0].split(':')[0],
          ...categorization,
          profiles: {
            'profile_1': {
              cumulative_time: data.cumulative_time,
              calls: data.calls,
              per_call: data.per_call,
              total_time: data.total_time,
              name: data.name
            },
            'profile_2': null,
            'profile_3': null
          }
        });
      });
    }

    // Add unique functions from profile 2
    if (response.comparison.unique_functions.profile_2) {
      response.comparison.unique_functions.profile_2.forEach((func: any) => {
        const data = func.data;
        const categorization = this.categorizeFunction(func.name);
        functions.push({
          id: id++,
          name: func.name.split('(')[0].split(':')[1] || func.name,
          filePath: func.name.split('(')[0].split(':')[0],
          ...categorization,
          profiles: {
            'profile_1': null,
            'profile_2': {
              cumulative_time: data.cumulative_time,
              calls: data.calls,
              per_call: data.per_call,
              total_time: data.total_time,
              name: data.name
            },
            'profile_3': null
          }
        });
      });
    }

    // Add unique functions from profile 3 if it exists
    if (response.comparison.unique_functions.profile_3) {
      response.comparison.unique_functions.profile_3.forEach((func: any) => {
        const data = func.data;
        const categorization = this.categorizeFunction(func.name);
        functions.push({
          id: id++,
          name: func.name,
          filePath: func.name.split('(')[0].split(':')[0],
          ...categorization,
          profiles: {
            'profile_1': null,
            'profile_2': null,
            'profile_3': {
              cumulative_time: data.cumulative_time,
              calls: data.calls,
              per_call: data.per_call,
              total_time: data.total_time,
              name: data.name
            }
          }
        });
      });
    }

    return functions;
  }

  private categorizeFunction(funcName: string): {
    isBuiltin: boolean;
    isStdlib: boolean;
    isThirdParty: boolean;
    category: 'builtin' | 'stdlib' | 'third_party' | 'user';
  } {
    const name = funcName.toLowerCase();
    
    // Enhanced built-in detection
    const builtinPatterns = [
      '<built-in>',
      '<method',
      '~',
      '<frozen',
      '<string>',
      '{built-in method',
      '{method'
    ];
    
    // Standard library patterns
    const stdlibPatterns = [
      'python3.',
      'python/',
      'lib/python',
      'site-packages',
      '/usr/lib/python',
      'importlib',
      'pkgutil',
      'encodings',
      'codecs',
      'collections',
      're.py',
      'json/',
      'urllib/',
      'logging/',
      'threading.py',
      'os.py',
      'sys.py'
    ];
    
    // Third-party library patterns
    const thirdPartyPatterns = [
      'site-packages/',
      'dist-packages/',
      'flask',
      'django',
      'requests',
      'numpy',
      'pandas',
      'scipy',
      'matplotlib',
      'sklearn',
      'tensorflow',
      'torch'
    ];
    
    // Check for built-in
    const isBuiltin = builtinPatterns.some(pattern => name.includes(pattern.toLowerCase())) ||
                     funcName.includes('__') && funcName.endsWith('__');
    
    // Check for standard library
    const isStdlib = stdlibPatterns.some(pattern => name.includes(pattern.toLowerCase()));
    
    // Check for third-party
    const isThirdParty = thirdPartyPatterns.some(pattern => name.includes(pattern.toLowerCase()));
    
    let category: 'builtin' | 'stdlib' | 'third_party' | 'user';
    if (isBuiltin) {
      category = 'builtin';
    } else if (isStdlib) {
      category = 'stdlib';
    } else if (isThirdParty) {
      category = 'third_party';
    } else {
      category = 'user';
    }
    
    return { isBuiltin, isStdlib, isThirdParty, category };
  }


  // Filtering & sorting
  public getFilteredFunctions(): FunctionProfile[] {
    let fns = [...(this.comparisonResults()?.functions || [])];
    console.log("fns : ", fns);

    // Apply category filters
    fns = fns.filter(f => {
      switch (f.category) {
        case 'builtin':
          return this.showBuiltinMethods;
        case 'stdlib':
          return this.showStdlibMethods;
        case 'third_party':
          return this.showThirdPartyMethods;
        case 'user':
          return this.showUserMethods;
        default:
          return true;
      }
    });

    // Apply time threshold filter
    fns = fns.filter(f => Object.values(f.profiles)
      .some(p => p != null && (p as ProfileData).cumulative_time >= this.filterThreshold));

    fns.sort((a, b) => {
      let aValue: any, bValue: any;
      switch (this.sortBy) {
        case 'function': aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase(); break;
        case 'cumTime':  aValue = this.getMaxProfileValue(a, 'cumulative_time');  bValue = this.getMaxProfileValue(b, 'cumulative_time');  break;
        case 'calls':    aValue = this.getMaxProfileValue(a, 'calls');    bValue = this.getMaxProfileValue(b, 'calls');    break;
        case 'perCall':  aValue = this.getMaxProfileValue(a, 'per_call');  bValue = this.getMaxProfileValue(b, 'per_call');  break;
        default: return 0;
      }
      return this.sortOrder === 'asc'
        ? (aValue > bValue ? 1 : (aValue < bValue ? -1 : 0))
        : (aValue < bValue ? 1 : (aValue > bValue ? -1 : 0));
    });
    console.log("fns sorted : ", fns);
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
    const gain = this.comparisonResults()?.summary?.performanceGain || '';
    if (gain.includes('+')) return 'positive';
    if (gain.includes('-')) return 'negative';
    return '';
  }
  getPerformanceInsights(): PerformanceInsight[] {
    if (!this.comparisonResults()) return [];

    const insights: PerformanceInsight[] = [];
    const metrics = this.comparisonResults()?.functions || [];

    // Check for significant time differences
    metrics.forEach(func => {
      const profile1 = func.profiles['profile_1'];
      const profile2 = func.profiles['profile_2'];

      if (profile1 && profile2) {
        // Compare execution times
        const timeDiff = Math.abs(profile1.cumulative_time - profile2.cumulative_time);
        const callsDiff = Math.abs(profile1.calls - profile2.calls);

        if (timeDiff > 0.1) { // More than 100ms difference
          insights.push({
            type: 'critical',
            impact: 'High',
            function: func.name,
            description: `Significant time difference: ${this.formatTime(profile1.cumulative_time)} vs ${this.formatTime(profile2.cumulative_time)}`
          });
        }

        // Compare call counts
        if (callsDiff > 1000) {
          insights.push({
            type: 'warning',
            impact: 'Medium',
            function: func.name,
            description: `Call count difference: ${this.formatCalls(profile1.calls)} vs ${this.formatCalls(profile2.calls)}`
          });
        }
      } else {
        // Function only exists in one profile
        const profile = profile1 || profile2;
        if (profile && profile.cumulative_time > 0.01) { // Only show if it takes more than 10ms
          insights.push({
            type: 'info',
            impact: 'Low',
            function: func.name,
            description: `Function only exists in ${profile1 ? 'Profile 1' : 'Profile 2'} with ${this.formatTime(profile.cumulative_time)} execution time`
          });
        }
      }
    });

    return insights;
  }

  // Export
  exportResults() {
    if (!this.comparisonResults()) return;
    const data = JSON.stringify(this.comparisonResults(), null, 2);
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