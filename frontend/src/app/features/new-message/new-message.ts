import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { ConversationStore } from '../../core/data/conversation.store';
import { DraftService } from '../../core/data/draft.service';
import { MentionDirectory } from '../../core/data/mention-directory';
import { Mention } from '../../core/data/mentions';
import { MessageStore } from '../../core/data/message.store';
import { UserStore } from '../../core/data/user.store';
import { ErrorService } from '../../core/errors/error.service';
import { Avatar } from '../../shared/ui/avatar';
import { ComposedMessage, Composer, PendingAttachment } from '../../shared/ui/composer';
import { Icon } from '../../shared/ui/icon';

const optionKey = (mention: Mention) => `${mention.kind}:${mention.id}`;

/**
 * `/new` ("Neue Nachricht"): the User picks a recipient, one of their Channels by `#Name`, a User by `@Name`
 * or a User by their exact email, and writes the first Message to it. Sending opens that Channel or DM.
 */
@Component({
  selector: 'app-new-message',
  imports: [
    Avatar,
    Combobox,
    ComboboxPopup,
    ComboboxWidget,
    Composer,
    Icon,
    Listbox,
    Option,
    TranslocoPipe,
  ],
  host: { class: 'contents' },
  template: `
    <main
      class="flex min-w-0 flex-1 flex-col bg-surface max-lg:hidden max-lg:group-data-[pane=main]:flex lg:rounded-30"
    >
      <header class="flex flex-col gap-20 px-16 py-20 shadow-header lg:px-45 lg:py-32">
        <h1 class="text-20 font-bold lg:text-24">{{ 'newMessage.title' | transloco }}</h1>
        <div class="relative flex flex-col gap-10">
          <div
            class="flex min-h-60 flex-wrap items-center gap-10 rounded-30 border border-border px-20 py-10 hover:border-border-hover has-[input:focus-visible]:border-border-focus"
            [class.border-error!]="missingRecipient()"
          >
            @if (recipient(); as recipient) {
              <span class="flex items-center gap-10 rounded-full bg-hover py-4 pr-8 pl-4">
                @if (recipient.kind === 'user') {
                  <app-avatar
                    [src]="avatarUrl(users.user(recipient.id)?.avatar ?? null)"
                    [name]="recipient.name"
                    [size]="40"
                    decorative
                  />
                } @else {
                  <app-icon name="tag" class="ml-8" />
                }
                {{ recipient.name }}
                <button
                  type="button"
                  class="rounded-full p-4 hover:text-menu-active"
                  [attr.aria-label]="'newMessage.remove' | transloco: { name: recipient.name }"
                  (click)="unpick()"
                >
                  <app-icon name="close" />
                </button>
              </span>
            } @else {
              <input
                ngCombobox
                #combobox="ngCombobox"
                #recipientInput
                class="min-w-0 flex-1 bg-transparent py-6 outline-none placeholder:text-text-muted"
                autocomplete="off"
                [(expanded)]="expanded"
                (input)="typed()"
                [placeholder]="'newMessage.recipientPlaceholder' | transloco"
                [attr.aria-label]="'newMessage.recipient' | transloco"
                [attr.aria-invalid]="missingRecipient()"
                [attr.aria-describedby]="missingRecipient() ? 'new-message-recipient-error' : null"
              />
              <ng-template ngComboboxPopup [combobox]="combobox">
                <div
                  ngComboboxWidget
                  ngListbox
                  #listbox="ngListbox"
                  focusMode="activedescendant"
                  selectionMode="explicit"
                  class="absolute top-full left-0 z-10 mt-10 flex max-h-300 w-full flex-col gap-5 overflow-y-auto rounded-20 border border-border bg-surface p-10 shadow-overlay"
                  [activeDescendant]="listbox.activeDescendant()"
                  [attr.aria-label]="'newMessage.matches' | transloco"
                  [hidden]="options().length === 0"
                  [value]="[]"
                  (valueChange)="pick($event)"
                >
                  @for (option of options(); track optionKey(option)) {
                    <div
                      ngOption
                      class="flex cursor-pointer items-center gap-15 rounded-full px-20 py-4 hover:bg-hover aria-selected:bg-hover data-[active=true]:bg-hover"
                      [value]="optionKey(option)"
                      [label]="option.name"
                    >
                      @if (option.kind === 'user') {
                        <app-avatar
                          [src]="avatarUrl(users.user(option.id)?.avatar ?? null)"
                          [name]="option.name"
                          [size]="40"
                          decorative
                        />
                      } @else {
                        <app-icon name="tag" />
                      }
                      {{ option.name }}
                    </div>
                  }
                </div>
              </ng-template>
            }
          </div>
          @if (missingRecipient()) {
            <p id="new-message-recipient-error" class="px-20 text-14 text-error">
              {{ 'newMessage.recipientMissing' | transloco }}
            </p>
          }
        </div>
      </header>
      <div class="flex-1"></div>
      <app-composer
        class="px-16 pb-16 lg:px-45 lg:pb-40"
        [label]="'newMessage.placeholder' | transloco"
        [text]="drafts.get('new')"
        (textChange)="drafts.set('new', $event)"
        [(attachments)]="attachments"
        [busy]="sending()"
        (send)="send($event)"
      />
    </main>
  `,
})
export class NewMessage {
  private readonly directory = inject(MentionDirectory);
  private readonly conversations = inject(ConversationStore);
  private readonly messages = inject(MessageStore);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly users = inject(UserStore);
  protected readonly drafts = inject(DraftService);

  protected readonly avatarUrl = avatarUrl;
  protected readonly optionKey = optionKey;
  protected readonly query = signal('');
  protected readonly expanded = signal(false);
  protected readonly recipient = signal<Mention | null>(null);
  /** Set when the User sent without a recipient, until they pick one. */
  protected readonly missingRecipient = signal(false);
  protected readonly sending = signal(false);
  /** The files attached in the composer. */
  protected readonly attachments = signal<readonly PendingAttachment[]>([]);

  private readonly recipientInput = viewChild<ElementRef<HTMLInputElement>>('recipientInput');
  private readonly combobox = viewChild(Combobox);

  /**
   * After `#` the User's Channels and after `@` every User, narrowed by what follows; otherwise only the User
   * whose email the query is exactly, so emails can't be guessed at letter by letter.
   */
  protected readonly options = computed((): Mention[] => {
    const query = this.query().trim();
    if (query.startsWith('#') || query.startsWith('@')) {
      return this.directory.candidates(query[0] as '#' | '@', query.slice(1));
    }
    const email = query.toLowerCase();
    const user = this.users.all().find((candidate) => candidate.email.toLowerCase() === email);
    return user ? [{ kind: 'user', id: user.id, name: user.name }] : [];
  });

  /**
   * After the combobox's own input handler, which opens the list on every keystroke: closed again while
   * nothing matches, so the field never reports a list that isn't there.
   */
  protected typed(): void {
    this.query.set(this.recipientInput()?.nativeElement.value ?? '');
    if (this.options().length === 0) {
      this.combobox()?.expanded.set(false);
    }
  }

  protected pick(keys: string[]): void {
    const picked = this.options().find((option) => optionKey(option) === keys[0]);
    if (picked) {
      this.recipient.set(picked);
      this.missingRecipient.set(false);
      this.query.set('');
      this.expanded.set(false);
    }
  }

  protected unpick(): void {
    this.recipient.set(null);
    this.focusRecipient();
  }

  /** Sends to the recipient's Channel or DM, the first Message creating the DM, and opens it. */
  protected async send({ text, attachmentIds }: ComposedMessage): Promise<void> {
    const recipient = this.recipient();
    if (!recipient) {
      this.missingRecipient.set(true);
      this.focusRecipient();
      return;
    }
    this.sending.set(true);
    try {
      if (recipient.kind === 'channel') {
        await this.messages.send(recipient.id, text, attachmentIds);
      } else {
        const sent = await this.messages.sendDirect(recipient.id, text, attachmentIds);
        // Without waiting for `conversation.upserted`, which a dropped connection would lose.
        this.conversations
          .ensure(sent.conversationId)
          .catch(() => this.errors.show(this.transloco.translate('errors.generic')));
      }
      this.drafts.set('new', '');
      this.attachments.set([]);
    } catch {
      this.errors.show(this.transloco.translate('errors.sendFailed'));
      return;
    } finally {
      this.sending.set(false);
    }
    await this.router.navigate(
      recipient.kind === 'channel' ? ['/channel', recipient.id] : ['/dm', recipient.id],
    );
  }

  /** After the input is back in place of the chip. */
  private focusRecipient(): void {
    afterNextRender(() => this.recipientInput()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
