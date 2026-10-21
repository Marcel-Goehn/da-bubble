// PROTOTYPE: fake data and in-memory state shared by the message-additions variants. Wipe me.
import { signal } from '@angular/core';

export type UserKey = 'noah' | 'sofia' | 'frederik';

export const USERS: Record<UserKey, { name: string; avatar: string }> = {
  noah: { name: 'Noah Braun', avatar: 'prototype-avatars/noah.png' },
  sofia: { name: 'Sofia Müller', avatar: 'prototype-avatars/sofia.png' },
  frederik: { name: 'Frederik Beck', avatar: 'prototype-avatars/frederik.png' },
};
export const ME: UserKey = 'frederik';

export interface Attachment {
  kind: 'image' | 'file';
  name: string;
  size: string;
  /** stand-in for the image itself */
  tint?: string;
}

export interface Msg {
  id: string;
  author: UserKey;
  time: string;
  text: string;
  edited?: boolean;
  deleted?: boolean;
  reactions: { emoji: string; count: number }[];
  attachments: Attachment[];
  replies?: { count: number; last: string };
}

export interface Pending {
  id: number;
  kind: 'image' | 'file';
  name: string;
  size: string;
  tint?: string;
  progress: number;
  error?: string;
}

const T1 = 'linear-gradient(135deg,#797ef3,#c5c8fb 60%,#fbd38d)';
const T2 = 'linear-gradient(160deg,#1d2a3f,#444df2 70%,#92c83e)';
const T3 = 'linear-gradient(120deg,#fbd38d,#f6a5c0 50%,#797ef3)';

function initialMessages(): Msg[] {
  return [
    {
      id: 'm1',
      author: 'noah',
      time: '14:25',
      text: 'Welche Version ist aktuell von Angular? Hier der Screenshot aus der Doku und die Roadmap.',
      reactions: [{ emoji: '🚀', count: 1 }],
      attachments: [
        { kind: 'image', name: 'angular-docs.png', size: '312 KB', tint: T1 },
        { kind: 'file', name: 'angular-roadmap-2026.pdf', size: '2,4 MB' },
      ],
      replies: { count: 2, last: '14:56' },
    },
    {
      id: 'm2',
      author: 'sofia',
      time: '14:30',
      text: '',
      deleted: true,
      reactions: [],
      attachments: [],
      replies: { count: 1, last: '14:41' },
    },
    {
      id: 'm3',
      author: 'frederik',
      time: '15:06',
      text: 'Ja, das ist es. Angular 22 ist aktuell, das Update lief bei uns ohne Probleme.',
      edited: true,
      reactions: [{ emoji: '👍', count: 1 }],
      attachments: [],
    },
    {
      id: 'm4',
      author: 'frederik',
      time: '15:10',
      text: 'Hier noch die Notizen und Fotos vom Whiteboard.',
      reactions: [],
      attachments: [
        { kind: 'image', name: 'whiteboard-1.jpg', size: '1,1 MB', tint: T2 },
        { kind: 'image', name: 'whiteboard-2.jpg', size: '980 KB', tint: T3 },
        { kind: 'image', name: 'whiteboard-3.jpg', size: '1,3 MB', tint: T1 },
        { kind: 'file', name: 'meeting-notizen.docx', size: '48 KB' },
      ],
    },
  ];
}

function initialPending(): Pending[] {
  return [
    { id: 1, kind: 'image', name: 'screenshot.png', size: '640 KB', tint: T3, progress: 55 },
    { id: 2, kind: 'file', name: 'bericht-q3.pdf', size: '1,2 MB', progress: 100 },
    {
      id: 3,
      kind: 'file',
      name: 'demo-video.mov',
      size: '48 MB',
      progress: 0,
      error: 'Datei zu groß (max. 10 MB)',
    },
  ];
}

/** Everything a variant can poke at; one instance per rendered frame. */
export class ChatState {
  readonly messages = signal(initialMessages());
  readonly pending = signal(initialPending());
  readonly text = signal('');
  /** message showing the reaction bar */
  readonly active = signal<string | null>('m4');
  readonly menuFor = signal<string | null>(null);
  readonly confirmFor = signal<string | null>(null);
  /** 'composer' or a message id */
  readonly emojiFor = signal<string | null>(null);
  readonly undo = signal<{ msg: Msg; index: number } | null>(null);
  private undoTimer?: ReturnType<typeof setTimeout>;
  private nextId = 10;

  constructor() {
    this.tick(1);
  }

  isMine = (m: Msg) => m.author === ME;
  user = (k: UserKey) => USERS[k];

  deleteMsg(id: string) {
    this.messages.update((all) =>
      all.map((m) =>
        m.id === id ? { ...m, deleted: true, text: '', reactions: [], attachments: [], edited: false } : m,
      ),
    );
    this.menuFor.set(null);
    this.confirmFor.set(null);
  }

  /** Variant C: hide now, "really" delete after the toast runs out. */
  deleteWithUndo(id: string) {
    const all = this.messages();
    const index = all.findIndex((m) => m.id === id);
    this.undo.set({ msg: all[index], index });
    this.deleteMsg(id);
    clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => this.undo.set(null), 6000);
  }

  undoDelete() {
    const u = this.undo();
    if (!u) return;
    this.messages.update((all) => all.map((m, i) => (i === u.index ? u.msg : m)));
    this.undo.set(null);
  }

  pickEmoji(unicode: string) {
    const target = this.emojiFor();
    if (target === 'composer') this.text.update((t) => t + unicode);
    else if (target)
      this.messages.update((all) =>
        all.map((m) => {
          if (m.id !== target) return m;
          const hit = m.reactions.find((r) => r.emoji === unicode);
          return {
            ...m,
            reactions: hit
              ? m.reactions.map((r) => (r === hit ? { ...r, count: r.count + 1 } : r))
              : [...m.reactions, { emoji: unicode, count: 1 }],
          };
        }),
      );
    this.emojiFor.set(null);
  }

  toggleEmoji(target: string) {
    this.emojiFor.update((t) => (t === target ? null : target));
    this.menuFor.set(null);
  }

  attachFake() {
    const id = this.nextId++;
    const image = id % 2 === 0;
    this.pending.update((p) => [
      ...p,
      image
        ? { id, kind: 'image', name: `foto-${id}.jpg`, size: '2,1 MB', tint: T2, progress: 0 }
        : { id, kind: 'file', name: `tabelle-${id}.xlsx`, size: '86 KB', progress: 0 },
    ]);
    this.tick(id);
  }

  removePending(id: number) {
    this.pending.update((p) => p.filter((x) => x.id !== id));
  }

  /** fake upload progress */
  private tick(id: number) {
    const timer = setInterval(() => {
      const p = this.pending().find((x) => x.id === id);
      if (!p || p.progress >= 100) return clearInterval(timer);
      this.pending.update((all) =>
        all.map((x) => (x.id === id ? { ...x, progress: Math.min(100, x.progress + 7) } : x)),
      );
    }, 400);
  }
}

export function ext(name: string) {
  return name.split('.').pop()!.toUpperCase();
}
