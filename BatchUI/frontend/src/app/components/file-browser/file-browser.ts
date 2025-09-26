import { Component, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScriptService, FileInfo } from '../../services/script-service';

@Component({
  selector: 'app-file-browser',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-browser.html',
  styleUrls: ['./file-browser.scss'],
})
export class FileBrowserComponent {
  private scriptService = inject(ScriptService);

  files = signal<FileInfo[]>([]);
  currentPath = signal<string>('');
  history = signal<string[]>(['']);
  historyIndex = signal<number>(0);

  get breadcrumb(): string[] {
    return this.currentPath().split('/').filter(Boolean);
  }

  constructor() {
    this.loadFiles('');
  }

  async loadFiles(path: string) {
    const fileList = await this.scriptService.browseFiles(path);
    this.files.set(Array.isArray(fileList) ? fileList : []);
    this.currentPath.set(path);
  }

  goToPath(path: string) {
    // If navigating from history, update history and index
    const newHistory = this.history().slice(0, this.historyIndex() + 1);
    newHistory.push(path);
    this.history.set(newHistory);
    this.historyIndex.set(newHistory.length - 1);
    this.loadFiles(path);
  }

  goBack() {
    if (this.canGoBack()) {
      const newIndex = this.historyIndex() - 1;
      this.historyIndex.set(newIndex);
      this.loadFiles(this.history()[newIndex]);
    }
  }

  goForward() {
    if (this.canGoForward()) {
      const newIndex = this.historyIndex() + 1;
      this.historyIndex.set(newIndex);
      this.loadFiles(this.history()[newIndex]);
    }
  }

  canGoBack(): boolean {
    return this.historyIndex() > 0;
  }

  canGoForward(): boolean {
    return this.historyIndex() < this.history().length - 1;
  }

  openFolder(file: FileInfo) {
    if (file.type === 'folder') {
      this.goToPath(file.path);
    }
  }

  goToBreadcrumb(index: number) {
    const parts = this.breadcrumb.slice(0, index + 1);
    const path = parts.join('/');
    this.goToPath(path);
  }

  async deleteFile(file: FileInfo) {
    if (confirm(`Are you sure you want to delete '${file.name}'?`)) {
      const success = await this.scriptService.deleteFileByPath(file.path);
      if (success) {
        this.loadFiles(this.currentPath());
      }
    }
  }
}
