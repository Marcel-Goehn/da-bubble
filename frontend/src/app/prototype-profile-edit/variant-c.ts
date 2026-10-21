// PROTOTYPE variant C "Avatar als Knopf": the edit dialog keeps the Figma layout plus an email field. The big
// Avatar itself is the control: click opens a menu (desktop popover, mobile bottom sheet), desktop also takes
// a dropped file. Saving a changed email asks first in a Figma-style dialog; the profile shows a badge.
import { Component, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Draft, PRESETS, ProtoDemo, ProtoWorkspace, SavedProfile } from './prototype-bits';

@Component({
  selector: 'app-variant-c',
  imports: [FormsModule, NgTemplateOutlet, ProtoWorkspace, ProtoDemo],
  template: `
    <app-proto-workspace [mobile]="mobile()" [name]="saved.name()" [avatar]="saved.avatar()">
      <div
        class="absolute z-10 overflow-y-auto rounded-[30px] bg-white font-sans shadow-[0_6px_14px_rgba(0,0,0,0.2)]"
        [class]="mobile() ? 'inset-x-4 top-[90px] max-h-[calc(100%-150px)] px-6 py-7' : 'top-[110px] right-6 max-h-[calc(100%-130px)] w-[500px] px-10 py-10'"
      >
        @if (view() === 'profile') {
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-bold">Profil</h2>
            <span class="material-symbols-outlined">close</span>
          </div>
          <img [src]="saved.avatar()" class="mx-auto mt-8 rounded-full object-cover" [class]="mobile() ? 'size-[160px]' : 'size-[200px]'" alt="" />
          <div class="mt-8 flex items-center justify-between">
            <span class="text-[32px] font-bold">{{ saved.name() }}</span>
            <button class="text-lg text-purple-3 hover:font-bold" (click)="edit()">Bearbeiten</button>
          </div>
          <p class="mt-3 flex items-center gap-3 text-xl text-[#92c83e]"><span class="size-4 rounded-full bg-[#92c83e]"></span>Aktiv</p>
          <div class="mt-6 flex gap-4">
            <span class="material-symbols-outlined">mail</span>
            <div>
              <p class="text-xl font-bold">E-Mail-Adresse</p>
              <p class="mt-3 text-lg text-[#1381ff]">{{ saved.email() }}</p>
              @if (saved.pendingEmail()) {
                <p class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span class="text-[#1381ff] opacity-60">{{ saved.pendingEmail() }}</span>
                  <span class="rounded-full bg-[#fff1d6] px-2 py-0.5 font-bold text-[#a26a00]">nicht bestätigt</span>
                </p>
              }
            </div>
          </div>
        } @else {
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-bold">Dein Profil bearbeiten</h2>
            <button class="material-symbols-outlined" (click)="view.set('profile')">close</button>
          </div>

          <div class="relative mx-auto mt-8 w-fit">
            <button
              class="relative block rounded-full outline-offset-4"
              [class]="dragOver() ? 'outline-4 outline-dashed outline-primary' : ''"
              (click)="menu.set(menu() ? null : 'menu')"
              (dragover)="$event.preventDefault(); dragOver.set(true)"
              (dragleave)="dragOver.set(false)"
              (drop)="onDrop($event)"
            >
              <img [src]="draft.avatar()" class="rounded-full object-cover" [class]="mobile() ? 'size-[160px]' : 'size-[200px]'" alt="" />
              @if (draft.uploading()) {
                <svg class="absolute -inset-1.5 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="#eceefe" stroke-width="3" />
                  <circle cx="50" cy="50" r="48" fill="none" stroke="#444df2" stroke-width="3" pathLength="100" [attr.stroke-dasharray]="draft.upload()!.progress + ' 100'" />
                </svg>
              }
              @if (dragOver()) {
                <span class="absolute inset-0 grid place-items-center rounded-full bg-primary/60 font-bold text-white">Loslassen zum Hochladen</span>
              }
              <span class="absolute right-2 bottom-2 grid size-11 place-items-center rounded-full bg-primary text-white shadow">
                <span class="material-symbols-outlined">edit</span>
              </span>
            </button>

            @if (!mobile() && menu() === 'menu') {
              <div class="absolute top-1/2 left-full z-20 ml-3 w-[250px] rounded-[20px_20px_20px_20px] bg-white p-3 shadow-[0_6px_14px_rgba(0,0,0,0.2)]">
                <ng-container *ngTemplateOutlet="menuItems" />
              </div>
            }
            @if (!mobile() && menu() === 'grid') {
              <div class="absolute top-1/2 left-full z-20 ml-3 grid w-[250px] grid-cols-3 gap-2 rounded-[20px] bg-white p-4 shadow-[0_6px_14px_rgba(0,0,0,0.2)]">
                <ng-container *ngTemplateOutlet="grid" />
              </div>
            }
          </div>

          @if (draft.error(); as e) {
            <p class="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-danger/10 px-4 py-2 text-sm text-danger">
              <span class="material-symbols-outlined !text-lg">error</span>{{ e }}
              <button class="material-symbols-outlined !text-lg" (click)="draft.error.set(null)">close</button>
            </p>
          } @else if (!mobile()) {
            <p class="mt-3 text-center text-sm text-text-gray">Klicken oder ein Bild draufziehen</p>
          }

          <label class="mt-6 flex items-center gap-4 text-xl font-bold"><span class="material-symbols-outlined">account_circle</span>Vollständiger Name</label>
          <input class="mt-3 h-[50px] w-full rounded-full border border-line px-5 text-lg outline-none focus:border-primary" [ngModel]="draft.name()" (ngModelChange)="draft.name.set($event)" />

          <label class="mt-5 flex items-center gap-4 text-xl font-bold"><span class="material-symbols-outlined">mail</span>E-Mail-Adresse</label>
          <input class="mt-3 h-[50px] w-full rounded-full border border-line px-5 text-lg outline-none focus:border-primary" [ngModel]="draft.email()" (ngModelChange)="draft.email.set($event)" />

          <div class="mt-8 flex justify-center gap-8">
            <button class="rounded-full border border-primary px-6 py-3 text-lg font-bold text-primary hover:bg-primary hover:text-white" (click)="view.set('profile')">Abbrechen</button>
            <button
              class="rounded-full bg-primary px-6 py-3 text-lg font-bold text-white hover:bg-purple-2 disabled:bg-neutral-300"
              [disabled]="draft.uploading()"
              (click)="draft.emailChanged() ? confirm.set(true) : save()"
            >Speichern</button>
          </div>
        }
      </div>

      @if (mobile() && menu()) {
        <div class="absolute inset-0 z-30 bg-black/30" (click)="menu.set(null)"></div>
        <div class="absolute inset-x-0 bottom-0 z-40 rounded-t-[30px] bg-white px-6 pt-3 pb-8 font-sans">
          <div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-300"></div>
          @if (menu() === 'menu') {
            <ng-container *ngTemplateOutlet="menuItems" />
          } @else {
            <p class="mb-3 text-lg font-bold">Aus der Liste wählen</p>
            <div class="grid grid-cols-3 gap-3"><ng-container *ngTemplateOutlet="grid" /></div>
          }
        </div>
      }

      @if (confirm()) {
        <div class="absolute inset-0 z-30 grid place-items-center bg-black/30 p-4 font-sans">
          <div class="w-full max-w-[460px] rounded-[30px] bg-white p-8 shadow-[0_6px_14px_rgba(0,0,0,0.2)]">
            <div class="flex items-start justify-between gap-4">
              <h3 class="text-2xl font-bold">E-Mail-Adresse ändern?</h3>
              <button class="material-symbols-outlined" (click)="confirm.set(false)">close</button>
            </div>
            <p class="mt-4 text-lg">
              Wir schicken einen Bestätigungslink an <b>{{ draft.email() }}</b>. Bis du ihn öffnest, bleibt
              <b>{{ saved.email() }}</b> deine Adresse für die Anmeldung.
            </p>
            <div class="mt-8 flex justify-end gap-4">
              <button class="rounded-full border border-primary px-6 py-3 text-lg font-bold text-primary hover:bg-primary hover:text-white" (click)="confirm.set(false)">Abbrechen</button>
              <button class="rounded-full bg-primary px-6 py-3 text-lg font-bold text-white hover:bg-purple-2" (click)="confirm.set(false); save()">Link senden</button>
            </div>
          </div>
        </div>
      }

      @if (view() === 'edit') {
        <app-proto-demo [draft]="draft" class="absolute bottom-3 left-3 z-20" />
      }
    </app-proto-workspace>

    <ng-template #menuItems>
      <label class="flex cursor-pointer items-center gap-3 rounded-full px-4 py-2.5 text-lg hover:bg-bg-lavender hover:text-purple-3">
        <span class="material-symbols-outlined">upload</span>Foto hochladen
        <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onFile($event)" />
      </label>
      <button class="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-lg hover:bg-bg-lavender hover:text-purple-3" (click)="menu.set('grid')">
        <span class="material-symbols-outlined">face</span>Aus der Liste wählen
      </button>
      @if (draft.upload() && draft.avatar() === draft.upload()!.src) {
        <button class="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-lg hover:bg-bg-lavender hover:text-danger" (click)="draft.removeUpload(); menu.set(null)">
          <span class="material-symbols-outlined">delete</span>Foto entfernen
        </button>
      }
      <p class="px-4 pt-2 text-sm text-text-gray">JPG, PNG oder WebP, bis 5 MB</p>
    </ng-template>

    <ng-template #grid>
      @for (p of presets; track p) {
        <button
          class="rounded-full border-[5px] transition"
          [class]="draft.avatar() === p ? 'border-bg-lavender' : 'border-transparent hover:border-neutral-200'"
          (click)="draft.avatar.set(p); menu.set(null)"
        >
          <img [src]="p" class="w-full rounded-full" alt="" />
        </button>
      }
    </ng-template>
  `,
})
export class VariantC {
  readonly mobile = input(false);
  protected readonly presets = PRESETS;
  protected readonly saved = new SavedProfile();
  protected readonly draft = new Draft(this.saved);
  protected readonly view = signal<'profile' | 'edit'>('profile');
  protected readonly menu = signal<'menu' | 'grid' | null>(null);
  protected readonly confirm = signal(false);
  protected readonly dragOver = signal(false);

  edit() {
    this.draft.reset();
    this.view.set('edit');
  }

  save() {
    this.draft.save();
    this.view.set('profile');
  }

  onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.draft.pickFile(f);
    (e.target as HTMLInputElement).value = '';
    this.menu.set(null);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(false);
    const f = e.dataTransfer?.files[0];
    if (f) this.draft.pickFile(f);
  }
}
