// PROTOTYPE variant A "Alles in einem Dialog": the Figma edit dialog grows an Avatar row
// (6 presets + upload tile) and an email field with an inline re-verification hint.
import { Component, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Draft, PRESETS, ProtoDemo, ProtoWorkspace, SavedProfile } from './prototype-bits';

@Component({
  selector: 'app-variant-a',
  imports: [FormsModule, ProtoWorkspace, ProtoDemo],
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
                <p class="mt-2 text-sm text-text-gray">
                  Neu: <b>{{ saved.pendingEmail() }}</b> · wartet auf Bestätigung
                  <br />
                  <button class="text-purple-3 hover:underline" (click)="resent.set(true)">{{ resent() ? 'Link erneut gesendet' : 'Link erneut senden' }}</button>
                  ·
                  <button class="text-purple-3 hover:underline" (click)="saved.pendingEmail.set(null)">Änderung verwerfen</button>
                </p>
              }
            </div>
          </div>
        } @else {
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-bold">Dein Profil bearbeiten</h2>
            <button class="material-symbols-outlined" (click)="view.set('profile')">close</button>
          </div>

          <div class="relative mx-auto mt-6 w-fit">
            <img [src]="draft.avatar()" class="rounded-full object-cover" [class]="mobile() ? 'size-[140px]' : 'size-[170px]'" alt="" />
          </div>

          <p class="mt-5 text-lg">Aus der Liste wählen oder eigenes Bild hochladen</p>
          <div class="mt-3 flex justify-between">
            @for (p of presets; track p) {
              <button
                class="rounded-full border-[3px] transition"
                [class]="draft.avatar() === p ? 'border-bg-lavender' : 'border-transparent hover:border-neutral-200'"
                (click)="draft.avatar.set(p)"
              >
                <img [src]="p" class="rounded-full" [class]="mobile() ? 'size-[34px]' : 'size-[44px]'" alt="" />
              </button>
            }
            @if (draft.upload(); as u) {
              <div class="relative">
                <button
                  class="rounded-full border-[3px] transition"
                  [class]="draft.avatar() === u.src ? 'border-bg-lavender' : 'border-transparent hover:border-neutral-200'"
                  (click)="draft.avatar.set(u.src)"
                >
                  <img [src]="u.src" class="rounded-full object-cover" [class]="mobile() ? 'size-[34px]' : 'size-[44px]'" alt="" />
                </button>
                @if (u.progress < 100) {
                  <span class="absolute inset-[3px] grid place-items-center rounded-full bg-black/45 text-xs font-bold text-white">{{ u.progress }}%</span>
                } @else {
                  <button
                    class="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-white shadow"
                    title="Eigenes Bild entfernen"
                    (click)="draft.removeUpload()"
                  >
                    <span class="material-symbols-outlined !text-xs">close</span>
                  </button>
                }
              </div>
            }
            <label
              class="grid cursor-pointer place-items-center rounded-full border-2 border-dashed text-purple-3 hover:bg-bg-lavender"
              [class]="(mobile() ? 'm-[3px] size-[34px] ' : 'm-[3px] size-[44px] ') + (draft.error() ? 'border-danger' : 'border-line')"
              title="Eigenes Bild hochladen"
            >
              <span class="material-symbols-outlined">add_a_photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onFile($event)" />
            </label>
          </div>
          @if (draft.error(); as e) {
            <p class="mt-2 flex items-center gap-1 text-sm text-danger"><span class="material-symbols-outlined !text-lg">error</span>{{ e }}</p>
          } @else {
            <p class="mt-2 text-sm text-text-gray">JPG, PNG oder WebP, bis 5 MB. Wird rund zugeschnitten.</p>
          }

          <label class="mt-6 flex items-center gap-4 text-xl font-bold"><span class="material-symbols-outlined">account_circle</span>Vollständiger Name</label>
          <input class="mt-3 h-[50px] w-full rounded-full border border-line px-5 text-lg outline-none focus:border-primary" [ngModel]="draft.name()" (ngModelChange)="draft.name.set($event)" />

          <label class="mt-5 flex items-center gap-4 text-xl font-bold"><span class="material-symbols-outlined">mail</span>E-Mail-Adresse</label>
          <input class="mt-3 h-[50px] w-full rounded-full border border-line px-5 text-lg outline-none focus:border-primary" [ngModel]="draft.email()" (ngModelChange)="draft.email.set($event)" />
          @if (draft.emailChanged()) {
            <p class="mt-2 flex gap-1 text-sm text-text-gray">
              <span class="material-symbols-outlined !text-lg text-purple-3">info</span>
              Nach dem Speichern schicken wir einen Bestätigungslink an die neue Adresse. Bis du ihn öffnest, gilt weiter {{ saved.email() }}.
            </p>
          }

          <div class="mt-8 flex justify-center gap-8">
            <button class="rounded-full border border-primary px-6 py-3 text-lg font-bold text-primary hover:bg-primary hover:text-white" (click)="view.set('profile')">Abbrechen</button>
            <button
              class="rounded-full bg-primary px-6 py-3 text-lg font-bold text-white hover:bg-purple-2 disabled:bg-neutral-300"
              [disabled]="draft.uploading()"
              (click)="draft.save(); view.set('profile')"
            >Speichern</button>
          </div>
        }
      </div>
      @if (view() === 'edit') {
        <app-proto-demo [draft]="draft" class="absolute bottom-3 left-3 z-20" />
      }
    </app-proto-workspace>
  `,
})
export class VariantA {
  readonly mobile = input(false);
  protected readonly presets = PRESETS;
  protected readonly saved = new SavedProfile();
  protected readonly draft = new Draft(this.saved);
  protected readonly view = signal<'profile' | 'edit'>('profile');
  protected readonly resent = signal(false);

  edit() {
    this.draft.reset();
    this.view.set('edit');
  }

  onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.draft.pickFile(f);
    (e.target as HTMLInputElement).value = '';
  }
}
