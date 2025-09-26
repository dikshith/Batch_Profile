import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';
import { SocketService } from './services/socket.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent {
  title = 'scripts-dashboard';

  private authService = inject(AuthService);
  private socketService = inject(SocketService);

  isAuthenticated = this.authService.getIsAuthenticated();
  currentUser = this.authService.getCurrentUser();

  refresh() {
    window.location.reload();
  }

  logout() {
    this.socketService.disconnect();
    this.authService.logout();
  }
}
