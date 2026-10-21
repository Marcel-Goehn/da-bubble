// PROTOTYPE variant B "Eigene Schritte": the Figma edit dialog stays as drawn; the Avatar opens a
// "Wähle deinen Avatar" step (sign-up look + upload button), the email has its own step that sends the
// link right away (like Keycloak's update-email page) and ends on a "check your inbox" card.
import { Component, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Draft, PRESETS, ProtoDemo, ProtoWorkspace, SavedProfile } from './prototype-bits';

type View = 'profile' | 'edit' | 'avatar' | 'email' | 'sent';

@Component({
  selector: 'app-variant-b',
  imports: [FormsModule, ProtoWorkspace, ProtoDemo],
  template: `
    <app-proto-workspace [mobile]="mobile()" [name]="saved.name()" [avatar]="saved.avatar()">
      <div
        class="absolute z-10 overflow-y-auto rounded-[30px] bg-white font-sans shadow-[0_6px_14px_rgba(0,0,0,0.2)]"
        [class]="mobile() ? 'inset-x-4 top-[90px] max-h-[calc(100%-150px)] px-6 py-7' : 'top-[110px] right-6 max-h-[calc(100%-130px)] w-[500px] px-10 py-10'"
      >
        @switch (view()) {
          @case ('profile') {
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
              </div>
            </div>
            @if (saved.pendingEmail()) {
              <div class="mt-5 flex gap-3 rounded-[20px] bg-bg-lavender px-4 py-3 text-sm">
                <span class="material-symbols-outlined text-purple-3">mark_email_unread</span>
                <span>Bestätige <b>{{ saved.pendingEmail() }}</b> über den Link in deinem Postfach, dann wird sie deine neue Adresse.</span>
              </div>
            }
          }

          @case ('edit') {
            <div class="flex items-center justify-between">
              <h2 class="text-2xl font-bold">Dein Profil bearbeiten</h2>
              <button class="material-symbols-outlined" (click)="view.set('profile')">close</button>
            </div>
            <button class="group relative mx-auto mt-8 block w-fit" (click)="view.set('avatar')">
              <img [src]="draft.avatar()" class="rounded-full object-cover" [class]="mobile() ? 'size-[160px]' : 'size-[200px]'" alt="" />
              <span class="absolute inset-0 grid place-items-center rounded-full bg-black/0 text-transparent transition group-hover:bg-black/40 group-hover:text-white">
                <span class="flex flex-col items-center font-bold"><span class="material-symbols-outlined !text-4xl">photo_camera</span>Ändern</span>
              </span>
              <span class="absolute right-2 bottom-2 grid size-11 place-items-center rounded-full bg-white text-purple-3 shadow group-hover:hidden">
                <span class="material-symbols-outlined">photo_camera</span>
              </span>
            </button>
            <label class="mt-8 flex items-center gap-4 text-xl font-bold"><span class="material-symbols-outlined">account_circle</span>Vollständiger Name</label>
            <input class="mt-3 h-[50px] w-full rounded-full border border-line px-5 text-lg outline-none focus:border-primary" [ngModel]="draft.name()" (ngModelChange)="draft.name.set($event)" />
            <div class="mt-6 flex items-center gap-4">
              <span class="material-symbols-outlined">mail</span>
              <span class="text-xl font-bold">E-Mail-Adresse</span>
              <button class="ml-auto text-lg text-purple-3 hover:font-bold" (click)="newEmail.set(''); view.set('email')">Ändern</button>
            </div>
            <p class="mt-2 ml-10 text-lg text-[#1381ff]">{{ saved.email() }}</p>
            <div class="mt-8 flex justify-center gap-8">
              <button class="rounded-full border border-primary px-6 py-3 text-lg font-bold text-primary hover:bg-primary hover:text-white" (click)="view.set('profile')">Abbrechen</button>
              <button class="rounded-full bg-primary px-6 py-3 text-lg font-bold text-white hover:bg-purple-2" (click)="draft.save(); view.set('profile')">Speichern</button>
            </div>
          }

          @case ('avatar') {
            <div class="flex items-center gap-4">
              <button class="material-symbols-outlined" (click)="view.set('edit')">arrow_back</button>
              <h2 class="text-[28px] font-bold text-primary">Wähle deinen Avatar</h2>
            </div>
            <div class="relative mx-auto mt-6 w-fit">
              <img [src]="draft.avatar()" class="rounded-full object-cover" [class]="mobile() ? 'size-[140px]' : 'size-[170px]'" alt="" />
              @if (draft.uploading()) {
                <span class="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-2xl font-bold text-white">{{ draft.upload()!.progress }}%</span>
              }
            </div>
            <p class="mt-6 text-lg">Aus der Liste wählen</p>
            <div class="mt-3 flex justify-between">
              @for (p of presets; track p) {
                <button
                  class="rounded-full border-[5px] transition"
                  [class]="draft.avatar() === p ? 'border-bg-lavender' : 'border-transparent hover:border-neutral-200'"
                  (click)="draft.avatar.set(p)"
                >
                  <img [src]="p" class="rounded-full" [class]="mobile() ? 'size-[42px]' : 'size-[56px]'" alt="" />
                </button>
              }
            </div>
            <div class="my-5 flex items-center gap-3 text-text-gray"><span class="h-px flex-1 bg-line"></span>oder<span class="h-px flex-1 bg-line"></span></div>
            @if (draft.upload(); as u) {
              <div
                class="flex items-center gap-3 rounded-full border-2 p-1.5 pr-4"
                [class]="draft.avatar() === u.src ? 'border-bg-lavender bg-bg-lavender' : 'border-line'"
              >
                <button (click)="draft.avatar.set(u.src)"><img [src]="u.src" class="size-11 rounded-full object-cover" alt="" /></button>
                <span class="min-w-0 flex-1 truncate">{{ u.name }}</span>
                @if (u.progress === 100) {
                  <label class="cursor-pointer text-purple-3 hover:font-bold">Anderes<input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onFile($event)" /></label>
                  <button class="material-symbols-outlined text-text-gray hover:text-danger" title="Entfernen" (click)="draft.removeUpload()">delete</button>
                }
              </div>
            } @else {
              <label
                class="flex cursor-pointer items-center justify-center gap-2 rounded-full border px-6 py-3 text-lg font-bold text-primary hover:bg-bg-lavender"
                [class]="draft.error() ? 'border-danger' : 'border-primary'"
              >
                <span class="material-symbols-outlined">upload</span>Eigenes Bild hochladen
                <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onFile($event)" />
              </label>
            }
            @if (draft.error(); as e) {
              <p class="mt-2 text-center text-sm text-danger">{{ e }}</p>
            } @else {
              <p class="mt-2 text-center text-sm text-text-gray">JPG, PNG oder WebP, bis 5 MB</p>
            }
            <div class="mt-6 flex justify-end">
              <button
                class="rounded-full bg-primary px-6 py-3 text-lg font-bold text-white hover:bg-purple-2 disabled:bg-neutral-300"
                [disabled]="draft.uploading()"
                (click)="view.set('edit')"
              >Übernehmen</button>
            </div>
          }

          @case ('email') {
            <div class="flex items-center gap-4">
              <button class="material-symbols-outlined" (click)="view.set('edit')">arrow_back</button>
              <h2 class="text-[28px] font-bold text-primary">E-Mail-Adresse ändern</h2>
            </div>
            <p class="mt-6 text-lg">Aktuell: <b>{{ saved.email() }}</b></p>
            <p class="mt-2 text-lg">Wir schicken dir einen Link an die neue Adresse. Erst wenn du ihn öffnest, wird sie geändert.</p>
            <input
              class="mt-6 h-[60px] w-full rounded-full bg-bg-lavender px-6 text-lg outline-none focus:ring-1 focus:ring-primary"
              placeholder="neue@beispiel.de"
              [ngModel]="newEmail()"
              (ngModelChange)="newEmail.set($event)"
            />
            <div class="mt-8 flex justify-end">
              <button
                class="rounded-full bg-primary px-6 py-3 text-lg font-bold text-white hover:bg-purple-2 disabled:bg-neutral-300"
                [disabled]="!newEmail().includes('@')"
                (click)="saved.pendingEmail.set(newEmail()); view.set('sent')"
              >Link senden</button>
            </div>
          }

          @case ('sent') {
            <div class="flex flex-col items-center text-center">
              <h2 class="text-[28px] font-bold text-primary">Prüfe dein Postfach</h2>
              <span class="material-symbols-outlined mt-6 !text-6xl text-purple-2">mark_email_unread</span>
              <p class="mt-6 text-lg">Wir haben einen Link an <b>{{ saved.pendingEmail() }}</b> gesendet. Bis du ihn öffnest, bleibt {{ saved.email() }} deine Adresse.</p>
              <button class="mt-4 text-purple-3 hover:underline" (click)="resent.set(true)">{{ resent() ? 'Erneut gesendet. Nächster Versuch in 30 s.' : 'Link erneut senden' }}</button>
              <button class="mt-8 rounded-full bg-primary px-6 py-3 text-lg font-bold text-white hover:bg-purple-2" (click)="view.set('edit')">Zurück zum Profil</button>
            </div>
          }
        }
      </div>
      @if (view() === 'avatar') {
        <app-proto-demo [draft]="draft" class="absolute bottom-3 left-3 z-20" />
      }
    </app-proto-workspace>
  `,
})
export class VariantB {
  readonly mobile = input(false);
  protected readonly presets = PRESETS;
  protected readonly saved = new SavedProfile();
  protected readonly draft = new Draft(this.saved);
  protected readonly view = signal<View>('profile');
  protected readonly newEmail = signal('');
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
