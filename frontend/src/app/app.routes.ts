import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // PROTOTYPE: throwaway route, see prototype-unread-legal/
    path: 'prototype/unread-legal',
    loadComponent: () =>
      import('./prototype-unread-legal/prototype-unread-legal.page').then(
        (m) => m.PrototypeUnreadLegalPage,
      ),
  },
];
