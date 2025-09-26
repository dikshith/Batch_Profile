import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthenticated = authService.getIsAuthenticated();

  if (!isAuthenticated()) {
    if (router.url !== '/connect-server') {
      router.navigate(['/connect-server'], { replaceUrl: true });
    }
    return false;
  }

  return true;
};
