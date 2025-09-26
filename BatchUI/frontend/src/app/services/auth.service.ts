import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ConnectServerService } from './connect-server.service';
import { BehaviorSubject } from 'rxjs';

export interface User {
  id: number;
  username: string;
  isActive: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: {
    id: number;
    username: string;
  };
}

export interface LoginResult {
  success: boolean;
  error?: string;
  token?: string;
  user?: {
    id: number;
    username: string;
  };
}

export interface UserInfoResponse {
  message: string;
  user: User;
}

export interface UpdateCredentialsRequest {
  newUsername: string;
  newPassword: string;
}

export interface UpdateCredentialsResponse {
  message: string;
  token: string;
  user: {
    id: number;
    username: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Signals
  private apiUrl = signal<string>(localStorage.getItem('apiUrl') || '');
  private currentUser = signal<User | null>(null);
  private isLoading = signal<boolean>(false);
  private error = signal<string | null>(null);
  private isAuthenticated = signal<boolean>(false);

  private connectServerService = inject(ConnectServerService);
  // Storage keys
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  // Logout event broadcaster
  private static logoutSubject = new BehaviorSubject<void>(undefined);

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth() {
    const token = this.getToken();
    const user = this.getUser();

    if (token && user) {
      this.isAuthenticated.set(true);
      this.currentUser.set({
        id: user.id,
        username: user.username,
        isActive: true,
      });
    }
  }

  // API URL Management
  getApiUrlSignal() {
    return this.apiUrl;
  }

  setApiUrl(url: string) {
    this.apiUrl.set(url);
    localStorage.setItem('apiUrl', url);
  }

  // Authentication State
  getIsAuthenticated() {
    return this.isAuthenticated.asReadonly();
  }

  getCurrentUser() {
    return this.currentUser.asReadonly();
  }

  getIsLoading() {
    return this.isLoading.asReadonly();
  }

  getError() {
    return this.error.asReadonly();
  }

  // Token Management
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getUser(): { id: number; username: string } | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  // Login
  async login(
    serverUrl: string,
    username: string,
    password: string
  ): Promise<LoginResult> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      // First test if server is reachable
      await this.connectServerService.testConnection(this.apiUrl());

      // Then attempt login
      const loginRequest: LoginRequest = { username, password };
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${serverUrl}/auth/login`, loginRequest)
      );

      // Save token and user info
      localStorage.setItem(this.TOKEN_KEY, response.token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));

      // Update state
      this.currentUser.set({
        id: response.user.id,
        username: response.user.username,
        isActive: true,
      });
      this.isAuthenticated.set(true);
      this.setApiUrl(serverUrl);

      // After setting isAuthenticated and currentUser
      setTimeout(() => {
        this.router.navigate(['/'], { replaceUrl: true });
      }, 0);

      return {
        success: true,
        token: response.token,
        user: response.user,
      };
    } catch (error: any) {
      console.error('Login error:', error);

      let errorMessage: string;

      if (error.status === 401) {
        errorMessage = 'Invalid username or password';
      } else if (error.status === 0 || error.status === 404) {
        errorMessage = 'Server is not running or URL is incorrect';
      } else {
        errorMessage = error.error?.message || 'Login failed';
      }

      // Set the error signal so it appears in the UI
      this.error.set(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      this.isLoading.set(false);
    }
  }

  // Logout
  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/connect-server']);
    // Broadcast logout event
    AuthService.logoutSubject.next();
  }

  // Handle unauthorized (token expired)
  handleUnauthorized() {
    console.log('Token expired or invalid, logging out...');
    this.logout();
  }

  // Load current user info
  async loadCurrentUser(): Promise<User | null> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const response = await firstValueFrom(
        this.http.get<UserInfoResponse>(`${this.apiUrl()}/auth/me`)
      );

      this.currentUser.set(response.user);
      return response.user;
    } catch (error: any) {
      console.error('Error loading current user:', error);
      this.error.set(error.error?.message || 'Failed to load user info');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  // Update credentials
  async updateCredentials(
    newUsername: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string; token?: string }> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const request: UpdateCredentialsRequest = {
        newUsername,
        newPassword,
      };

      const response = await firstValueFrom(
        this.http.patch<UpdateCredentialsResponse>(
          `${this.apiUrl()}/auth/credentials`,
          request
        )
      );

      // Update the stored token and user info
      localStorage.setItem(this.TOKEN_KEY, response.token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));

      // Update current user
      this.currentUser.set({
        id: response.user.id,
        username: response.user.username,
        isActive: true,
      });

      return {
        success: true,
        token: response.token,
      };
    } catch (error: any) {
      console.error('Error updating credentials:', error);
      const errorMessage =
        error.error?.message || 'Failed to update credentials';
      this.error.set(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      this.isLoading.set(false);
    }
  }

  clearError() {
    this.error.set(null);
  }

  // Allow other services to listen for logout
  static getLogoutObservable() {
    return AuthService.logoutSubject.asObservable();
  }
}
