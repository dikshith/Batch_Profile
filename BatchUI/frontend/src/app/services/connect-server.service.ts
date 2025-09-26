import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';


@Injectable({
  providedIn: 'root',
})
export class ConnectServerService {
  private http = inject(HttpClient);

  private isConnecting = signal<boolean>(false);
  private connectionError = signal<string | null>(null);

  getIsConnecting() {
    return this.isConnecting.asReadonly();
  }

  getConnectionError() {
    return this.connectionError.asReadonly();
  }

  async testConnection(serverUrl: string): Promise<boolean> {
    try {
      this.isConnecting.set(true);
      this.connectionError.set(null);

      const response = await firstValueFrom(
        this.http.get<{ message: string }>(`${serverUrl}/auth/test`)
      );

      return true;
    } catch (error: any) {
      console.error('Connection test error:', error);

      if (error.status === 0 || error.status === 404) {
        this.connectionError.set('Server is not running or URL is incorrect');
      } else {
        this.connectionError.set(error.error?.message || 'Connection failed');
      }

      return false;
    } finally {
      this.isConnecting.set(false);
    }
  }

  clearError() {
    this.connectionError.set(null);
  }
}
