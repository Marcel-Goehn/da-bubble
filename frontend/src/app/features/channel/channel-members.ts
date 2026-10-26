import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { ConversationStore } from '../../core/data/conversation.store';
import { PresenceStore } from '../../core/data/presence.store';
import { UserStore } from '../../core/data/user.store';
import { ErrorService } from '../../core/errors/error.service';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { UndoService } from '../../shared/ui/undo-toast';
import { ProfileCards } from '../profile/profile-cards';
import { openAddMembers } from './add-members-dialog';

/** A Member as their row shows them. */
interface MemberRow {
  userId: string;
  name: string;
  avatarSrc: string | null;
  isMe: boolean;
  isCreator: boolean;
  isAdmin: boolean;
  /** Whether the User may grant, revoke and remove here: an Admin may, except on the Creator and themselves. */
  manageable: boolean;
}

interface MemberGroup {
  kind: 'admins' | 'members' | 'everyone';
  rows: MemberRow[];
}

let nextId = 0;

/**
 * A Channel's Members, "Mitglieder" (Channel Admins variant B): grouped into "ADMINS · n" and "MITGLIEDER · n", the User
 * first, then the Creator with a ⭐. An Admin gets "Verwalten", which adds an Admin switch and a remove button
 * to each row they may manage, and "Mitglieder hinzufügen"; a removal can be undone from a toast. Others get a
 * line saying only Admins can. The Default Channel lists everyone flat, with no controls.
 */
@Component({
  selector: 'app-channel-members',
  imports: [Avatar, Icon, TranslocoPipe],
  host: { class: 'flex flex-col gap-10' },
  template: `
    @if (iAmAdmin()) {
      <button
        #manageButton
        type="button"
        class="self-end rounded-20 px-10 py-4 text-interactive hover:text-interactive-hover hover:underline"
        [attr.aria-pressed]="managing()"
        (click)="managing.set(!managing())"
      >
        {{ (managing() ? 'channelMembers.done' : 'channelMembers.manage') | transloco }}
      </button>
    }
    @for (group of groups(); track group.kind) {
      @if (group.rows.length > 0) {
        <h3
          [id]="id + group.kind"
          class="px-15 text-14 font-bold tracking-wide text-text-muted uppercase"
        >
          @switch (group.kind) {
            @case ('admins') {
              {{ 'channelMembers.admins' | transloco: { count: group.rows.length } }}
            }
            @case ('members') {
              {{ 'channelMembers.members' | transloco: { count: group.rows.length } }}
            }
            @case ('everyone') {
              {{ 'channelMembers.everyone' | transloco: { count: group.rows.length } }}
            }
          }
        </h3>
        <ul class="flex flex-col" [attr.aria-labelledby]="id + group.kind">
          @for (row of group.rows; track row.userId) {
            <li class="flex items-center gap-15 rounded-30 px-15 py-5">
              <span class="relative">
                <app-avatar
                  [src]="row.avatarSrc"
                  [name]="row.name"
                  [size]="50"
                  [presence]="presence.of(row.userId)"
                  decorative
                />
                @if (row.isCreator) {
                  <span
                    class="absolute -top-4 -left-4 flex size-24 items-center justify-center rounded-full bg-accent p-4 text-text-inverse shadow-avatar"
                  >
                    <app-icon name="starFilled" fillContainer />
                  </span>
                }
              </span>
              <span class="flex min-w-0 flex-1 flex-col items-start">
                <button
                  type="button"
                  class="max-w-full truncate text-18 hover:text-interactive"
                  (click)="profiles.open(row.userId)"
                >
                  @if (row.isMe) {
                    {{ 'channelMembers.you' | transloco: { name: row.name } }}
                  } @else {
                    {{ row.name }}
                  }
                </button>
                @if (row.isCreator) {
                  <span class="text-14 text-text-muted">{{
                    'channelMembers.creator' | transloco
                  }}</span>
                }
              </span>
              @if (managing()) {
                @if (row.manageable) {
                  <button
                    type="button"
                    role="switch"
                    class="flex items-center gap-8 rounded-20 p-4 text-14 text-text-muted disabled:cursor-wait"
                    [attr.aria-checked]="row.isAdmin"
                    [attr.aria-label]="'channelMembers.adminSwitch' | transloco: { name: row.name }"
                    [disabled]="busy().includes(row.userId)"
                    (click)="setAdmin(row)"
                  >
                    <span aria-hidden="true">{{ 'channelMembers.admin' | transloco }}</span>
                    <span
                      aria-hidden="true"
                      class="relative h-24 w-40 rounded-full transition-colors"
                      [class.bg-accent]="row.isAdmin"
                      [class.bg-disabled]="!row.isAdmin"
                    >
                      <span
                        class="absolute top-2 left-2 size-20 rounded-full bg-surface transition-transform"
                        [class.translate-x-16]="row.isAdmin"
                      ></span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="rounded-full p-8 text-error hover:bg-hover disabled:cursor-wait"
                    [attr.aria-label]="'channelMembers.remove' | transloco: { name: row.name }"
                    [disabled]="busy().includes(row.userId)"
                    (click)="remove(row)"
                  >
                    <app-icon name="personRemove" />
                  </button>
                } @else if (row.isCreator) {
                  <span class="text-14 text-text-muted">
                    {{ 'channelMembers.alwaysAdmin' | transloco }}
                  </span>
                }
              }
            </li>
          }
        </ul>
      }
    }
    @if (iAmAdmin()) {
      <button
        type="button"
        class="flex items-center gap-15 self-start rounded-full py-8 pr-15 pl-20 text-18 hover:text-interactive"
        (click)="add()"
      >
        <span class="flex size-40 items-center justify-center rounded-full bg-hover">
          <app-icon name="personAdd" />
        </span>
        {{ 'channelMembers.add' | transloco }}
      </button>
    } @else if (channel() && !channel()!.isDefault) {
      <p class="flex items-center gap-8 px-15 text-14 text-text-muted">
        <app-icon name="info" />
        {{ 'channelMembers.onlyAdmins' | transloco }}
      </p>
    }
  `,
})
export class ChannelMembers {
  private readonly conversations = inject(ConversationStore);
  private readonly users = inject(UserStore);
  private readonly dialog = inject(Dialog);
  private readonly undo = inject(UndoService);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);

  readonly channelId = input.required<number>();

  protected readonly presence = inject(PresenceStore);
  protected readonly profiles = inject(ProfileCards);
  protected readonly id = `channel-members-${nextId++}-`;
  protected readonly managing = signal(false);
  private readonly manageButton = viewChild<ElementRef<HTMLButtonElement>>('manageButton');
  /** Members a change is in flight for. */
  protected readonly busy = signal<string[]>([]);

  protected readonly channel = computed(() => this.conversations.get(this.channelId()));
  protected readonly iAmAdmin = computed(() => this.conversations.isAdmin(this.channelId()));

  /** The User first, then the Creator, then the others in the order they joined. */
  private readonly rows = computed<MemberRow[]>(() => {
    const channel = this.channel();
    const me = this.users.me()?.id;
    if (!channel) {
      return [];
    }
    const rank = (row: MemberRow) => (row.isMe ? 0 : row.isCreator ? 1 : 2);
    return channel.members
      .flatMap((member) => {
        const user = this.users.user(member.userId);
        if (!user) {
          return [];
        }
        const isMe = member.userId === me;
        const isCreator = member.userId === channel.creatorId;
        return {
          userId: member.userId,
          name: user.name,
          avatarSrc: avatarUrl(user),
          isMe,
          isCreator,
          isAdmin: member.isAdmin,
          manageable: this.iAmAdmin() && !isMe && !isCreator,
        };
      })
      .sort((a, b) => rank(a) - rank(b));
  });

  protected readonly groups = computed<MemberGroup[]>(() => {
    const rows = this.rows();
    if (this.channel()?.isDefault) {
      return [{ kind: 'everyone', rows }];
    }
    return [
      { kind: 'admins', rows: rows.filter((row) => row.isAdmin) },
      { kind: 'members', rows: rows.filter((row) => !row.isAdmin) },
    ];
  });

  protected add(): void {
    openAddMembers(this.dialog, this.channelId());
  }

  protected setAdmin(row: MemberRow): Promise<void> {
    return this.change(row.userId, () =>
      this.conversations.setAdmin(this.channelId(), row.userId, !row.isAdmin),
    );
  }

  /** Removes at once, with an undo toast that restores the Admin flag and join time. */
  protected remove(row: MemberRow): Promise<void> {
    const channelId = this.channelId();
    return this.change(row.userId, async () => {
      const removed = await this.conversations.removeMember(channelId, row.userId);
      this.undo.show(
        this.transloco.translate('channelMembers.removed', { name: row.name }),
        () => void this.conversations.restoreMember(channelId, removed).catch(() => this.failed()),
        () => this.manageButton()?.nativeElement,
      );
    });
  }

  private async change(userId: string, apply: () => Promise<void>): Promise<void> {
    this.busy.update((busy) => [...busy, userId]);
    try {
      await apply();
    } catch {
      this.failed();
    } finally {
      this.busy.update((busy) => busy.filter((id) => id !== userId));
    }
  }

  private failed(): void {
    this.errors.show(this.transloco.translate('errors.manageMembersFailed'));
  }
}
