import { HttpContext } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChannelsService } from '../../api/generated/channels/channels.service';
import { ConversationsService } from '../../api/generated/conversations/conversations.service';
import { ConversationDto, CreateChannelRequest } from '../../api/generated/model';
import { ROUTED_READ } from '../errors/error.interceptor';
import { UserStore } from './user.store';

export type { ConversationDto, CreateChannelRequest };

const byName = new Intl.Collator(undefined, { sensitivity: 'base' });

/** The Default Channel's shown names, in German and English; no other Channel may use them. */
const reservedChannelNames = ['allgemein', 'general'];

/** The Conversations the logged-in User can see: their Channels and their DMs, as the sidebar lists them. */
@Service()
export class ConversationStore {
  private readonly api = inject(ConversationsService);
  private readonly channelsApi = inject(ChannelsService);
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

  /** The self-DM first, then the others by latest activity. */
  readonly directMessages = computed(() => {
    const me = this.users.me()?.id;
    return [...this.byId().values()]
      .filter((conversation) => conversation.kind === 'DIRECT_MESSAGE')
      .sort(
        (a, b) =>
          Number(b.partnerId === me) - Number(a.partnerId === me) ||
          Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt),
      );
  });

  /** The DM with the User [partnerId], if it exists (it does once it has a Message). */
  directMessageWith(partnerId: string): ConversationDto | undefined {
    return this.directMessages().find((dm) => dm.partnerId === partnerId);
  }

  readonly defaultChannel = computed(() => this.channels().find((channel) => channel.isDefault));

  /**
   * Whether the Channel name [name] is known to be taken, ignoring case and surrounding spaces: reserved, or
   * one of the User's Channels'. Only the server knows the names of Channels the User isn't a Member of.
   */
  isChannelNameTaken(name: string): boolean {
    const wanted = name.trim().toLowerCase();
    return (
      reservedChannelNames.includes(wanted) ||
      this.channels().some(
        (channel) => !channel.isDefault && channel.name?.toLowerCase() === wanted,
      )
    );
  }

  /** Creates a Channel with the User as its Creator; it joins the sidebar without waiting for its event. */
  async createChannel(request: CreateChannelRequest): Promise<ConversationDto> {
    const created = await firstValueFrom(this.channelsApi.createChannel(request));
    this.upsert(created);
    return created;
  }

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
   * Fetches the sidebar again and replaces what's held, catching up on whatever changed meanwhile. Replaced
   * rather than merged, so a Conversation the User lost access to meanwhile disappears.
   */
  async refresh(): Promise<void> {
    const conversations = await firstValueFrom(this.api.listConversations());
    this.byId.set(new Map(conversations.map((c) => [c.id, c])));
    // Counts as loaded: a later `load` needn't fetch again.
    this.loading = Promise.resolve();
  }

  /**
   * The Conversation a route opens. One missing from the sidebar is asked for, so the error interceptor
   * sends the User to `/` when they can't see it.
   */
  open(id: number): Promise<ConversationDto> {
    return this.ensure(id, new HttpContext().set(ROUTED_READ, true));
  }

  /** The Conversation [id], asked for if the sidebar doesn't hold it, e.g. a DM the User just created. */
  async ensure(id: number, context?: HttpContext): Promise<ConversationDto> {
    await this.load();
    const known = this.get(id);
    if (known) {
      return known;
    }
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
