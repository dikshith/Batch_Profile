import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ScriptService, Script } from '../../services/script-service';

@Component({
  selector: 'app-script-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './script-edit.html',
  styleUrl: './script-edit.scss',
})
export class ScriptEdit implements OnInit {
  private scriptService = inject(ScriptService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  script = signal<Script>({
    id: 0,
    name: '',
    description: '',
    type: 'powershell',
    scriptContent: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  error = signal<string>('');
  isSubmitting = false;

  async ngOnInit() {
    this.route.paramMap.subscribe(async (params) => {
      const scriptId = Number(params.get('id'));
      console.log('scriptId', scriptId);
      const script = await this.scriptService.getScriptWithContentById(
        Number(scriptId)
      );
      if (script) {
        this.script.set({ ...script });
        console.log('script', this.script());
      } else {
        this.error.set('Script not found');
      }
    });
  }

  async onSubmit() {
    if (this.isSubmitting) return;

    this.isSubmitting = true;
    this.error.set('');

    try {
      await this.scriptService.updateScript(this.script().id, this.script());
      this.router.navigate(['/']);
    } catch (err) {
      this.error.set('Failed to update script. Please try again.');
      console.error('Error updating script:', err);
    } finally {
      this.isSubmitting = false;
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
