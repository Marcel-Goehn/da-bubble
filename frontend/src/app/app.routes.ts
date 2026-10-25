import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { avatarStepGuard, meGuard } from './core/data/me.guard';
import { channelGuard } from './features/conversation/channel.guard';
import { dmGuard } from './features/conversation/dm.guard';

// The Thread pane opens beside its Conversation on desktop and replaces it on mobile.
const threadRoute = {
  path: 'thread/:messageId',
  data: { pane: 'thread' },
  loadComponent: () => import('./features/thread/thread-pane').then((m) => m.ThreadPane),
};

const loadConversationPane = () =>
  import('./features/conversation/conversation-pane').then((m) => m.ConversationPane);

export const routes: Routes = [
  // Public, so the legal information is reachable without logging in.
  {
    path: 'impressum',
    loadComponent: () => import('./features/legal/impressum').then((m) => m.Impressum),
  },
  {
    path: 'datenschutz',
    loadComponent: () => import('./features/legal/datenschutz').then((m) => m.Datenschutz),
  },
  {
    // Guards of one route run in parallel, but a parent's run before its children's: /api/me waits for the login.
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'avatar',
        canActivate: [avatarStepGuard],
        loadComponent: () => import('./features/avatar-step/avatar-step').then((m) => m.AvatarStep),
      },
      {
        path: '',
        canActivate: [meGuard],
        loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
        children: [
          {
            path: '',
            pathMatch: 'full',
            data: { pane: 'menu' },
            loadComponent: () =>
              import('./features/shell/workspace-home').then((m) => m.WorkspaceHome),
          },
          {
            path: 'new',
            data: { pane: 'main' },
            loadComponent: () =>
              import('./features/new-message/new-message').then((m) => m.NewMessage),
          },
          {
            path: 'channel/:id',
            canActivate: [channelGuard],
            data: { pane: 'main' },
            loadComponent: loadConversationPane,
            children: [threadRoute],
          },
          {
            path: 'dm/:userId',
            canActivate: [dmGuard],
            data: { pane: 'main' },
            loadComponent: loadConversationPane,
            children: [threadRoute],
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
