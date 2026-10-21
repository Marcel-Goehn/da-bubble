// PROTOTYPE: state and Figma pieces shared by the unread-and-legal variants. In memory only; reload resets.
import { Component, computed, input, output, signal } from '@angular/core';

export type Variant = 'A' | 'B' | 'C';

export interface Conv {
  id: string;
  kind: 'channel' | 'dm';
  name: string;
  avatar?: string;
  online?: boolean;
  isMe?: boolean;
  unread: number;
  /** DMs: listed only once there's a Message (own DM always). */
  hasMessages: boolean;
  lastActivity: number;
}

const av = (i: number) => `prototype-avatars/avatar-${i}.png`;

/** Frederik ("Du") in a small Workspace. The scenario bar pushes Messages and Replies in. */
export class UnreadState {
  readonly convs = signal<Conv[]>([]);
  readonly currentId = signal('entwickler');
  readonly threadOpen = signal(false);
  readonly replies = signal(2);
  readonly newReplies = signal(1);
  readonly collapsed = signal<{ channel: boolean; dm: boolean }>({ channel: false, dm: false });
  readonly log = signal<string[]>([]);
  private clock = 100;

  readonly channels = computed(() => this.convs().filter((c) => c.kind === 'channel'));
  readonly dms = computed(() =>
    this.convs()
      .filter((c) => c.kind === 'dm' && (c.isMe || c.hasMessages))
      .sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : b.lastActivity - a.lastActivity)),
  );
  readonly current = computed(() => this.convs().find((c) => c.id === this.currentId())!);
  readonly channelSum = computed(() => this.channels().reduce((s, c) => s + c.unread, 0));
  readonly dmSum = computed(() => this.dms().reduce((s, c) => s + c.unread, 0));

  constructor() {
    this.reset();
  }

  reset() {
    this.clock = 100;
    this.currentId.set('entwickler');
    this.threadOpen.set(false);
    this.replies.set(2);
    this.newReplies.set(1);
    this.collapsed.set({ channel: false, dm: false });
    this.log.set([]);
    const ch = (id: string, name: string, unread: number, t: number): Conv => ({ id, kind: 'channel', name, unread, hasMessages: true, lastActivity: t });
    const dm = (id: string, name: string, i: number, online: boolean, unread: number, t: number, extra: Partial<Conv> = {}): Conv => ({
      id, kind: 'dm', name, avatar: av(i), online, unread, hasMessages: t > 0, lastActivity: t, ...extra,
    });
    this.convs.set([
      ch('allgemein', 'Allgemein', 3, 50),
      ch('entwickler', 'Entwicklerteam', 0, 60),
      ch('office', 'Office-Team', 12, 40),
      dm('fred', 'Frederik Beck', 3, true, 0, 1, { isMe: true }),
      dm('sofia', 'Sofia Müller', 2, true, 2, 30),
      dm('noah', 'Noah Braun', 1, true, 0, 20),
      dm('elise', 'Elise Roth', 4, false, 1, 10),
      dm('elias', 'Elias Neumann', 5, true, 0, 0),
      dm('steffen', 'Steffen Hoffmann', 6, true, 0, 0),
    ]);
  }

  open(id: string) {
    this.currentId.set(id);
    this.threadOpen.set(false);
    this.patch(id, { unread: 0 });
    this.note(`${this.find(id).name} geöffnet`);
  }

  openThread() {
    this.threadOpen.set(true);
    this.newReplies.set(0);
    this.note('Thread geöffnet');
  }

  /** A Message from someone else; counts unless that Conversation is open. */
  incoming(id: string, n = 1) {
    const c = this.find(id);
    const open = this.currentId() === id;
    this.patch(id, { unread: open ? 0 : c.unread + n, hasMessages: true, lastActivity: ++this.clock });
    this.note(`${n > 1 ? n + ' Nachrichten' : 'Nachricht'} in ${c.kind === 'dm' ? '@' : '#'}${c.name}${open ? ' (offen, zählt nicht)' : ''}`);
  }

  /** A Reply in the Entwicklerteam Thread: counts in "N neu" unless the Thread is open, and in the sidebar unless the Channel is open. */
  incomingReply() {
    this.replies.update((r) => r + 1);
    if (!this.threadOpen()) this.newReplies.update((r) => r + 1);
    if (this.currentId() !== 'entwickler') this.patch('entwickler', { unread: this.find('entwickler').unread + 1 });
    this.patch('entwickler', { lastActivity: ++this.clock });
    this.note('Antwort im Thread');
  }

  toggle(section: 'channel' | 'dm') {
    this.collapsed.update((c) => ({ ...c, [section]: !c[section] }));
  }

  showLegal(page: 'Impressum' | 'Datenschutz') {
    this.note(`${page} geöffnet`);
  }

  private find(id: string) {
    return this.convs().find((c) => c.id === id)!;
  }

  private patch(id: string, p: Partial<Conv>) {
    this.convs.update((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  private note(s: string) {
    this.log.update((l) => [...l.slice(-5), s]);
  }
}

export const cap = (n: number) => (n > 99 ? '99+' : String(n));

/** Figma Avatar with Presence dot; projected content sits on top (for badges). */
@Component({
  selector: 'app-proto-avatar',
  template: `
    <span class="relative block size-[50px] shrink-0">
      <img [src]="src()" class="size-full rounded-full" alt="" />
      <span class="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-white" [class]="online() ? 'bg-[#92c83e]' : 'bg-text-gray'"></span>
      <ng-content />
    </span>
  `,
})
export class ProtoAvatar {
  readonly src = input.required<string>();
  readonly online = input(false);
}

/** Figma Impressum / Datenschutz card, shown over the frame. */
@Component({
  selector: 'app-proto-legal',
  template: `
    <div class="absolute inset-0 z-40 grid place-items-center bg-bg-lavender p-4 font-sans">
      <div class="w-full max-w-[600px] rounded-[30px] bg-white p-10">
        <button class="material-symbols-outlined rounded-full p-1 hover:bg-bg-lavender" (click)="back.emit()">arrow_back</button>
        <h2 class="mt-4 text-4xl font-bold text-primary">{{ page() }}</h2>
        <p class="mt-3">[Student Names List]<br />[Address of the DABubble operator]<br />[Postcode and city]</p>
      </div>
    </div>
  `,
})
export class ProtoLegal {
  readonly page = input.required<string>();
  readonly back = output();
}
