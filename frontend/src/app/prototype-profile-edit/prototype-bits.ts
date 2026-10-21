// PROTOTYPE: state and Figma pieces shared by the profile-edit variants. In memory only; reload resets.
import { Component, input, signal } from '@angular/core';

export const PRESETS = [1, 2, 3, 4, 5, 6].map((i) => `prototype-avatars/avatar-${i}.png`);
export const PHOTO = 'prototype-avatars/photo.jpg';
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

export interface Upload {
  src: string;
  name: string;
  progress: number;
}

/** What the server has (after "Speichern"). */
export class SavedProfile {
  readonly name = signal('Frederik Beck');
  readonly email = signal('fred.beck@email.com');
  /** New address waiting for its confirmation link; the old one stays active until then. */
  readonly pendingEmail = signal<string | null>(null);
  readonly avatar = signal(PRESETS[2]);
  readonly isUpload = signal(false);
}

/** What the open edit dialog holds. */
export class Draft {
  readonly name = signal('');
  readonly email = signal('');
  readonly avatar = signal('');
  readonly upload = signal<Upload | null>(null);
  readonly error = signal<string | null>(null);

  constructor(private readonly saved: SavedProfile) {
    this.reset();
  }

  reset() {
    this.name.set(this.saved.name());
    this.email.set(this.saved.pendingEmail() ?? this.saved.email());
    this.avatar.set(this.saved.avatar());
    this.upload.set(this.saved.isUpload() ? { src: this.saved.avatar(), name: 'mein-foto.jpg', progress: 100 } : null);
    this.error.set(null);
  }

  emailChanged() {
    return this.email().trim() !== this.saved.email();
  }

  uploading() {
    const u = this.upload();
    return !!u && u.progress < 100;
  }

  pickFile(file: File) {
    this.check(file.name, file.type, file.size, URL.createObjectURL(file));
  }

  /** Demo buttons, so the error states can be seen without hunting for files. */
  demoPhoto() {
    this.check('urlaub-portrait.jpg', 'image/jpeg', 2.1e6, PHOTO);
  }
  demoTooBig() {
    this.check('kamera-original.jpg', 'image/jpeg', 8.4e6, PHOTO);
  }
  demoWrongType() {
    this.check('animation.gif', 'image/gif', 0.9e6, PHOTO);
  }

  removeUpload() {
    if (this.avatar() === this.upload()?.src) this.avatar.set(PRESETS[0]);
    this.upload.set(null);
  }

  save() {
    this.saved.name.set(this.name().trim());
    if (this.emailChanged()) this.saved.pendingEmail.set(this.email().trim());
    else this.saved.pendingEmail.set(null);
    this.saved.avatar.set(this.avatar());
    this.saved.isUpload.set(this.avatar() === this.upload()?.src);
  }

  private check(name: string, type: string, size: number, src: string) {
    if (!ALLOWED.includes(type)) {
      this.error.set(`„${name}“ geht nicht: nur JPG, PNG oder WebP.`);
      return;
    }
    if (size > MAX_MB * 1e6) {
      this.error.set(`„${name}“ ist zu groß (${(size / 1e6).toFixed(1).replace('.', ',')} MB). Maximal ${MAX_MB} MB.`);
      return;
    }
    this.error.set(null);
    const u: Upload = { src, name, progress: 0 };
    this.upload.set(u);
    this.avatar.set(src);
    const tick = setInterval(() => {
      const cur = this.upload();
      if (cur?.src !== src) return clearInterval(tick);
      const progress = Math.min(100, cur.progress + 9);
      this.upload.set({ ...cur, progress });
      if (progress === 100) clearInterval(tick);
    }, 120);
  }
}

/** Fake workspace behind the dialog: Figma header with the user menu trigger. */
@Component({
  selector: 'app-proto-workspace',
  template: `
    <div class="relative flex h-full flex-col bg-bg-lavender font-sans">
      <header class="flex h-[70px] shrink-0 items-center gap-4 px-6" [class.h-[80px]]="!mobile()">
        <span class="flex items-center gap-2 text-xl font-bold">
          <span class="grid size-9 place-items-center rounded-lg bg-primary text-sm text-white">DA</span>
          @if (!mobile()) { DABubble } @else { Devspace }
        </span>
        @if (!mobile()) {
          <div class="mx-auto flex h-[50px] w-[480px] items-center rounded-full bg-white px-5 text-text-gray">
            Devspace durchsuchen<span class="material-symbols-outlined ml-auto">search</span>
          </div>
        }
        <span class="ml-auto flex items-center gap-3 text-xl font-bold">
          @if (!mobile()) { {{ name() }} }
          <span class="relative">
            <img [src]="avatar()" class="size-[50px] rounded-full object-cover" alt="" />
            <span class="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-white bg-[#92c83e]"></span>
          </span>
          @if (!mobile()) { <span class="material-symbols-outlined">keyboard_arrow_down</span> }
        </span>
      </header>
      <div class="mx-4 mb-4 flex-1 rounded-[30px] bg-white/60"></div>
      <div class="absolute inset-0 bg-black/20"></div>
      <ng-content />
    </div>
  `,
})
export class ProtoWorkspace {
  readonly mobile = input(false);
  readonly name = input.required<string>();
  readonly avatar = input.required<string>();
}

/** Dashed strip under each frame with the demo uploads (not part of the design). */
@Component({
  selector: 'app-proto-demo',
  template: `
    <div class="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-neutral-400 bg-white/80 px-3 py-2 font-mono text-xs">
      <span class="text-neutral-500">Demo-Upload:</span>
      <button class="rounded bg-neutral-200 px-2 py-0.5 hover:bg-neutral-300" (click)="draft().demoPhoto()">Foto 2,1 MB</button>
      <button class="rounded bg-neutral-200 px-2 py-0.5 hover:bg-neutral-300" (click)="draft().demoTooBig()">8,4 MB</button>
      <button class="rounded bg-neutral-200 px-2 py-0.5 hover:bg-neutral-300" (click)="draft().demoWrongType()">GIF</button>
    </div>
  `,
})
export class ProtoDemo {
  readonly draft = input.required<Draft>();
}
