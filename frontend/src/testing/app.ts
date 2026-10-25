import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { App } from '../app/app';
import { routes } from '../app/app.routes';
import { provideApi } from '../app/core/api/api.providers';
import { ConversationDto, MemberDto } from '../app/core/data/conversation.store';
import { MessageDto } from '../app/core/data/message.store';
import { UnreadDto } from '../app/core/data/read.store';
import { RealtimeService } from '../app/core/data/realtime.service';
import { UserDto } from '../app/core/data/user.store';
import { Language } from '../app/core/i18n/i18n.providers';
import { EmojiPickerLoader } from '../app/shared/ui/emoji-picker-loader';
import { FakeEmojiPickerLoader } from './fake-emoji-picker';
import { FakeKeycloak, provideFakeKeycloak } from './fake-keycloak';
import { FakeRealtimeService } from './fake-realtime';
import { provideI18nTesting } from './i18n';
import { FakeIntersectionObserver } from './intersection-observer';

export const ada: UserDto = {
  id: '7d1e0c2a-0000-4000-8000-000000000001',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  avatar: 'AVATAR_1',
};

export const alan: UserDto = {
  id: '7d1e0c2a-0000-4000-8000-000000000002',
  name: 'Alan Turing',
  email: 'alan@example.com',
  avatar: 'AVATAR_2',
};

export const grace: UserDto = {
  id: '7d1e0c2a-0000-4000-8000-000000000003',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  avatar: 'AVATAR_3',
};

/** When the test Conversations last had activity, unless a test says otherwise. */
const lastActivityAt = new Date(2026, 0, 15, 9, 0).toISOString();

/** A Member [userId] of a Channel, joined at [joinedAt] (an ISO instant). */
export function member(
  userId: string,
  { isAdmin = false, joinedAt = lastActivityAt }: { isAdmin?: boolean; joinedAt?: string } = {},
): MemberDto {
  return { userId, isAdmin, joinedAt };
}

export const defaultChannel: ConversationDto = {
  id: 1,
  kind: 'CHANNEL',
  name: 'Allgemein',
  description: null,
  creatorId: null,
  isDefault: true,
  partnerId: null,
  lastActivityAt,
  // Everyone, which in these tests is at most Ada, Alan and Grace; it has no Admins.
  members: [ada, alan, grace].map((user) => member(user.id)),
};

/**
 * The Channel [name], with no description and, unless given, created by [creatorId] = Ada, who is its only
 * Member unless [members] are given.
 */
export function channel(
  id: number,
  name: string,
  {
    description = null,
    creatorId = ada.id,
    members = [member(creatorId, { isAdmin: true })],
  }: { description?: string | null; creatorId?: string; members?: MemberDto[] } = {},
): ConversationDto {
  return {
    id,
    kind: 'CHANNEL',
    name,
    description,
    creatorId,
    isDefault: false,
    partnerId: null,
    lastActivityAt,
    members,
  };
}

/** The DM with [partnerId]; [activeAt] is its last activity, an ISO instant. */
export function directMessage(
  id: number,
  partnerId: string,
  activeAt = lastActivityAt,
): ConversationDto {
  return {
    id,
    kind: 'DIRECT_MESSAGE',
    name: null,
    description: null,
    creatorId: null,
    isDefault: false,
    partnerId,
    lastActivityAt: activeAt,
    members: [],
  };
}

/** A top-level Message by [authorId] in [conversationId], sent at [createdAt] (an ISO instant). */
export function message(
  id: number,
  text: string,
  {
    authorId = ada.id,
    conversationId = 1,
    createdAt = new Date(2026, 0, 15, 14, 25).toISOString(),
  }: { authorId?: string; conversationId?: number; createdAt?: string } = {},
): MessageDto {
  return {
    id,
    conversationId,
    authorId,
    parentMessageId: null,
    text,
    createdAt,
    editedAt: null,
    deletedAt: null,
    replyCount: 0,
    lastReplyAt: null,
    reactions: [],
  };
}

/** A Reply by [authorId] in the Thread of [parentId], sent at [createdAt] (an ISO instant). */
export function reply(
  id: number,
  parentId: number,
  text: string,
  options: { authorId?: string; conversationId?: number; createdAt?: string } = {},
): MessageDto {
  return { ...message(id, text, options), parentMessageId: parentId };
}

export const noUnread: UnreadDto = { conversations: [], threads: [] };

export interface RenderAppOptions {
  url?: string;
  me?: UserDto;
  /** The sidebar, answered once the shell asks for it (only Users with an Avatar get there); `null` fails it. */
  conversations?: ConversationDto[] | null;
  /** Every User of the Workspace; defaults to [me] alone. */
  users?: UserDto[];
  /** What the User hasn't read, answered once the shell asks for it; defaults to nothing. */
  unread?: UnreadDto;
  keycloak?: FakeKeycloak;
  lang?: Language;
}

/**
 * Renders the whole app (toasts included) with its real routes at [url], answering `/api/me` and the sidebar request.
 * Returns before the navigation settles, so a test can answer further requests first.
 */
export async function startApp({
  url = '/',
  me = ada,
  conversations = [defaultChannel, directMessage(2, me.id)],
  users = [me],
  unread = noUnread,
  keycloak = new FakeKeycloak(),
  lang = 'de',
}: RenderAppOptions = {}) {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  const result = await render(App, {
    routes,
    providers: [
      provideApi(),
      provideHttpClientTesting(),
      provideFakeKeycloak(keycloak),
      provideI18nTesting(lang),
      FakeRealtimeService,
      { provide: RealtimeService, useExisting: FakeRealtimeService },
      { provide: EmojiPickerLoader, useClass: FakeEmojiPickerLoader },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const realtime = TestBed.inject(FakeRealtimeService);
  const navigation = result.navigate(url);
  (await vi.waitFor(() => http.expectOne('/api/me'))).flush(me);
  if (me.avatar !== null) {
    const request = await vi.waitFor(() => http.expectOne('/api/conversations'));
    if (conversations === null) {
      request.flush(null, { status: 500, statusText: 'Internal Server Error' });
    } else {
      request.flush(conversations);
    }
  }
  return { ...result, http, keycloak, navigation, realtime, users, unread };
}

/** Lets the stores' awaited responses land, then rendering finish. */
export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

/** [startApp], then waits for the navigation, answers the Users request and lets rendering settle. */
export async function renderApp(options: RenderAppOptions = {}) {
  const app = await startApp(options);
  await app.navigation;
  // The shell asks for the Users once the route's guards have let it render.
  app.http.match('/api/users').forEach((request) => request.flush(app.users));
  app.http.match('/api/conversations/unread').forEach((request) => request.flush(app.unread));
  await app.fixture.whenStable();
  return app;
}
