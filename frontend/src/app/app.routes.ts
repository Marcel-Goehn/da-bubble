import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // PROTOTYPE: throwaway route, see prototype-profile-edit/
    path: 'prototype/profile-edit',
    loadComponent: () =>
      import('./prototype-profile-edit/prototype-profile-edit.page').then(
        (m) => m.PrototypeProfileEditPage,
      ),
  },
];
