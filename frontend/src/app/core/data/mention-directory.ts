import { computed, inject, Service } from '@angular/core';
import { translateSignal } from '@jsverse/transloco';
import { ConversationStore } from './conversation.store';
import { Mention, MentionLookup, MentionTrigger } from './mentions';
import { UserStore } from './user.store';

/** Folds case and accents, so "muller" finds "Müller". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * The Users and Channels Mentions point at, as the logged-in User knows them: the current names a Message's
 * Mentions show under, and what the `@` and `#` pickers offer.
 */
@Service()
export class MentionDirectory {
  private readonly users = inject(UserStore);
  private readonly conversations = inject(ConversationStore);
  private readonly defaultChannelName = translateSignal('channel.default');

  /** Every User, as Mentions. */
  private readonly userMentions = computed(() =>
    this.users.all().map((user): Mention => ({ kind: 'user', id: user.id, name: user.name })),
  );
  /** The User's own Channels, as Mentions under their shown names: the Default Channel's translated. */
  private readonly channelMentions = computed(() =>
    this.conversations.channels().map((channel): Mention => ({
      kind: 'channel',
      id: channel.id,
      name: channel.isDefault ? this.defaultChannelName() : (channel.name ?? ''),
    })),
  );

  /**
   * Current names: any known User's, and the shown name of a Channel the User is a Member of. A Channel they
   * aren't in, or one that was deleted, is unknown, so its Mentions read as plain text and never open it.
   */
  readonly lookup: MentionLookup = {
    userName: (id) => this.users.user(id)?.name,
    channelName: (id) => this.channelMentions().find((channel) => channel.id === id)?.name,
  };

  /**
   * What the picker offers after `@` (every User) or `#` (the User's Channels) whose name contains [query].
   * The query isn't trimmed: the space after a picked `@Name ` keeps the name from being offered again.
   */
  candidates(trigger: MentionTrigger, query: string): Mention[] {
    const wanted = fold(query);
    const all = trigger === '@' ? this.userMentions() : this.channelMentions();
    return all.filter((mention) => fold(mention.name).includes(wanted));
  }
}
