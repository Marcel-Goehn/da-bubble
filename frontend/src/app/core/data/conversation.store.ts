import { HttpContext } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConversationsService } from '../../api/generated/conversations/conversations.service';
import { ConversationDto } from '../../api/generated/model';
import { ROUTED_READ } from '../errors/error.interceptor';
import { UserStore } from './user.store';

export type { ConversationDto };

const byName = new Intl.Collator(undefined, { sensitivity: 'base' });

/** The Conversations the logged-in User can see: their Channels and their DMs, as the sidebar lists them. */
@Service()
export class ConversationStore {
  private readonly api = inject(ConversationsService);
  private readonly users = inject(UserStore);
  private readonly byId = signal(new Map<number, ConversationDto>());
  private loading: Promise<void> | null = null;

  /** The Default Channel first, then the others alphabetically (its shown name is translated, so not by name). */
  readonly channels = computed(() =>
    [...this.byId().values()]
      .filter((conversation) => conversation.kind === 'CHANNEL')
      .sort(
        (a, b) =>
          Number(b.isDefault) - Number(a.isDefault) || byName.compare(a.name ?? '', b.name ?? ''),
      ),
  );

  /** The self-DM first. TODO(#56): order the others by latest activity; until then the newest first. */
  readonly directMessages = computed(() => {
    const me = this.users.me()?.id;
    return [...this.byId().values()]
      .filter((conversation) => conversation.kind === 'DIRECT_MESSAGE')
      .sort((a, b) => Number(b.partnerId === me) - Number(a.partnerId === me) || b.id - a.id);
  });

  readonly defaultChannel = computed(() => this.channels().find((channel) => channel.isDefault));

  /** Fetches the sidebar once; later calls wait for the same request. */
  load(): Promise<void> {
    this.loading ??= firstValueFrom(this.api.listConversations()).then(
      (conversations) => this.byId.set(new Map(conversations.map((c) => [c.id, c]))),
      (error: unknown) => {
        this.loading = null;
        throw error;
      },
    );
    return this.loading;
  }

  /**
   * The Conversation a route opens. One missing from the sidebar is asked for, so the error interceptor
   * sends the User to `/` when they can't see it.
   */
  async open(id: number): Promise<ConversationDto> {
    await this.load();
    const known = this.get(id);
    if (known) {
      return known;
    }
    const context = new HttpContext().set(ROUTED_READ, true);
    const conversation = await firstValueFrom(this.api.getConversation(id, { context }));
    this.upsert(conversation);
    return conversation;
  }

  /** The Conversation with [id], if the User can see it. */
  get(id: number): ConversationDto | undefined {
    return this.byId().get(id);
  }

  upsert(conversation: ConversationDto): void {
    this.byId.update((map) => new Map(map).set(conversation.id, conversation));
  }

  remove(id: number): void {
    this.byId.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }
}
