import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService, User, UpdateCredentialsRequest, UpdateCredentialsResponse,} from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Use AuthService's API URL signal
  private get apiUrl() {
    return this.authService.getApiUrlSignal();
  }

  // Expose AuthService signals for components
  getCurrentUser() {
    return this.authService.getCurrentUser();
  }

  getIsLoading() {
    return this.authService.getIsLoading();
  }

  getError() {
    return this.authService.getError();
  }

  async createUser(
    username: string,
    password: string
  ): Promise<{ user: User; message: string }> {
    const res = await firstValueFrom(
      this.http.post<{ user: User; message: string }>(
        `${this.apiUrl()}/auth/users/create`,
        { username, password }
      )
    );
    return res;
  }

  // Load current user info
  async loadCurrentUser(): Promise<User | null> {
    return this.authService.loadCurrentUser();
  }

  // Update credentials
  async updateCredentials(
    newUsername: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string; token?: string }> {
    return this.authService.updateCredentials(newUsername, newPassword);
  }

  clearError() {
    this.authService.clearError();
  }
}
