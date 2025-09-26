import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ScriptService,
  CreateScriptRequest,
} from '../../services/script-service';

import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-script-add',
  imports: [CommonModule, FormsModule],
  templateUrl: './script-add.html',
  styleUrl: './script-add.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScriptAdd {
  @Output() close = new EventEmitter<void>();

  private scriptService = inject(ScriptService);

  isLoading = false;

  addMode = signal<'text' | 'file'>('text');

  errorMessage = signal<string | null>(null);

  // Form data
  scriptData: CreateScriptRequest = {
    name: '',
    description: '',
    type: 'powershell',
    scriptContent: '',
  };

  selectedFile: File[] = [];

  switchMode(mode: 'text' | 'file') {
    this.addMode.set(mode);
    this.selectedFile = [];
    this.scriptData.scriptContent = '';
    this.errorMessage.set(null);
  }

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedFile = Array.from(target.files);
      this.errorMessage.set(null);
    }
  }

  onDirectorySelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedFile = Array.from(target.files);
      this.errorMessage.set(null);

      console.log(this.selectedFile);

      // Auto-fill name from directory name if empty
      if (!this.scriptData.name && this.selectedFile.length > 0) {
        const firstFile = this.selectedFile[0];
        if (firstFile.webkitRelativePath) {
          const directoryName = firstFile.webkitRelativePath.split('/')[0];
          this.scriptData.name = directoryName;
        }
      }
    }
  }

  removeFile(index: number) {
    this.selectedFile = this.selectedFile.filter((_, i) => i !== index);
    if (this.selectedFile.length === 0) {
      this.errorMessage.set(null);
    }
  }

  clearFiles() {
    this.selectedFile = [];
    this.errorMessage.set(null);
  }

  async onSubmit() {
    if (this.isLoading) return;

    try {
      this.isLoading = true;

      if (this.addMode() === 'file' && this.selectedFile) {
        // File upload mode
        const formData = new FormData();
        this.selectedFile.forEach((file) => {
          if (file.webkitRelativePath) {
            formData.append(file.webkitRelativePath, file);
          } else {
            formData.append(file.name, file);
          }
        });
        formData.append('name', this.scriptData.name);
        formData.append('description', this.scriptData.description);
        formData.append('type', this.scriptData.type);

        await this.scriptService.uploadFiles(formData);
      } else {
        // Text mode
        await this.scriptService.createScript(this.scriptData);
      }
      console.log('script created');
      this.close.emit();
      this.resetForm();
    } catch (error: any) {
      let msg = 'Creating script failed';

      this.errorMessage.set(error || msg);
    } finally {
      this.isLoading = false;
    }
  }

  resetForm() {
    this.scriptData = {
      name: '',
      description: '',
      type: 'batch',
      scriptContent: '',
    };
    this.selectedFile = [];
    this.addMode.set('text');
    this.errorMessage.set(null);
  }

  onCancel() {
    this.resetForm();
    this.close.emit();
  }

  isFormValid(): boolean {
    const baseValid = !!(
      this.scriptData.name.trim() && this.scriptData.description.trim()
    );

    if (this.addMode() === 'file') {
      return !!(this.selectedFile.length > 0);
    } else {
      return baseValid && !!this.scriptData.scriptContent.trim();
    }
  }
}
