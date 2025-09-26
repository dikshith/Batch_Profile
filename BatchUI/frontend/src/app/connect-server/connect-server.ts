import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ConnectServerService } from '../services/connect-server.service';

@Component({
  selector: 'app-connect-server',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './connect-server.html',
  styleUrl: './connect-server.scss',
})
export class ConnectServerComponent {
  private authService = inject(AuthService);
  private connectServerService = inject(ConnectServerService);

  // Form data
  serverUrl = signal<string>('');
  username = signal<string>('');
  password = signal<string>('');

  // UI state
  isConnecting = this.connectServerService.getIsConnecting();
  connectionError = this.connectServerService.getConnectionError();
  isLoggingIn = this.authService.getIsLoading();
  loginError = this.authService.getError();

  // Success state
  connectionSuccess = signal<boolean>(false);
  successMessage = signal<string>('');

  async testConnection() {
    if (!this.serverUrl()) {
      this.connectServerService.clearError();
      this.connectionSuccess.set(false);
      return;
    }

    const success = await this.connectServerService.testConnection(
      this.serverUrl()
    );
    if (success) {
      this.connectionSuccess.set(true);
      this.successMessage.set(
        'Server connection successful! You can now proceed to login.'
      );

      // Clear success message after 5 seconds
      setTimeout(() => {
        this.connectionSuccess.set(false);
        this.successMessage.set('');
      }, 5000);
          } else {
      this.connectionSuccess.set(false);
    }
  }

  async login() {
    if (!this.serverUrl() || !this.username() || !this.password()) {
      return;
    }

    // Clear success message when attempting login
    this.connectionSuccess.set(false);
    this.successMessage.set('');

    const result = await this.authService.login(
      this.serverUrl(),
      this.username(),
      this.password()
    );

    if (!result.success) {
      console.error('Login failed:', result.error);
      // Error message will be displayed via the loginError signal from AuthService
          }
  }

  clearErrors() {
    this.connectServerService.clearError();
    this.authService.clearError();
    this.connectionSuccess.set(false);
    this.successMessage.set('');
  }

  onServerUrlChange() {
    // Clear success state when user changes the server URL
    this.connectionSuccess.set(false);
    this.successMessage.set('');
  }
}
