import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { ScriptList } from './components/script-list/script-list';
import { ScriptAdd } from './components/script-add/script-add';
import { ScriptEdit } from './components/script-edit/script-edit';
import { ScriptLogs } from './components/script-logs/script-logs';
import { Runs } from './components/runs/runs';
import { CleanupComponent } from './components/cleanup/cleanup';
import { ConnectServerComponent } from './connect-server/connect-server';
import { UserInfoComponent } from './components/user-info/user-info';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: Dashboard,
    canActivate: [authGuard],
  },
  {
    path: 'scripts',
    component: ScriptList,
    canActivate: [authGuard],
  },
  {
    path: 'scripts/add',
    component: ScriptAdd,
    canActivate: [authGuard],
  },
  {
    path: 'scripts/:id/edit',
    component: ScriptEdit,
    canActivate: [authGuard],
  },
  {
    path: 'scripts/:id/logs',
    component: ScriptLogs,
    canActivate: [authGuard],
  },
  {
    path: 'runs',
    component: Runs,
    canActivate: [authGuard],
  },
  {
    path: 'cleanup',
    component: CleanupComponent,
    canActivate: [authGuard],
  },
  {
    path: 'user-info',
    component: UserInfoComponent,
    canActivate: [authGuard],
  },
  {
    path: 'connect-server',
    component: ConnectServerComponent,
    /* canActivate: [authGuard], */
  },
  {
    path: 'logs',
    component: ScriptLogs,
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
