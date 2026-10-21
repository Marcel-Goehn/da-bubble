import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // PROTOTYPE: throwaway route, see prototype-channel-admins/
    path: 'prototype/channel-admins',
    loadComponent: () =>
      import('./prototype-channel-admins/prototype-channel-admins.page').then(
        (m) => m.PrototypeChannelAdminsPage,
      ),
  },
];
