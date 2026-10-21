import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // PROTOTYPE: throwaway route, see prototype-message-additions/
    path: 'prototype/message-additions',
    loadComponent: () =>
      import('./prototype-message-additions/prototype-message-additions.page').then(
        (m) => m.PrototypeMessageAdditionsPage,
      ),
  },
];
