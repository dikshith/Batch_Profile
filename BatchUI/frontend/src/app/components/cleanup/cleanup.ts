import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AutomatedCleanupComponent } from './automated-cleanup';
import { ManualCleanupComponent } from './manual-cleanup';

@Component({
  selector: 'app-cleanup',
  standalone: true,
  imports: [CommonModule, AutomatedCleanupComponent, ManualCleanupComponent],
  templateUrl: './cleanup.html',
  styleUrls: ['./cleanup.scss'],
})
export class CleanupComponent {
  // Tab selection
  selectedTab = signal<'automated' | 'manual'>('manual');

  setTab(tab: 'automated' | 'manual') {
    this.selectedTab.set(tab);
  }
}
