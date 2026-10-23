import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { meGuard } from './core/data/me.guard';

export const routes: Routes = [
  {
    // Guards of one route run in parallel, but a parent's run before its children's: /api/me waits for the login.
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        canActivate: [meGuard],
        loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
      },
    ],
  },
];
