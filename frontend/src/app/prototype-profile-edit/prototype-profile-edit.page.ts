// PROTOTYPE: three variants of "Dein Profil bearbeiten" with email and Avatar upload, switchable via
// ?variant= on /prototype/profile-edit. Each variant renders a desktop frame and a 430px mobile frame side by side.
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { PrototypeSwitcher, PrototypeVariant } from '../shared/prototype-switcher';
import { VariantA } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';

const VARIANTS: (PrototypeVariant & { notes: string[] })[] = [
  {
    key: 'A',
    name: 'Alles in einem Dialog',
    notes: [
      'Avatar-Reihe direkt im Dialog: 6 Avatare + Kachel „Eigenes Bild“',
      'Hochgeladenes Bild wird 7. Kreis mit ✕ und Prozent',
      'Fehler rot unter der Reihe',
      'E-Mail als Feld, Hinweis erscheint sobald geändert',
      'Speichern sendet den Link; Profil zeigt „Neu: … wartet auf Bestätigung“',
    ],
  },
  {
    key: 'B',
    name: 'Eigene Schritte',
    notes: [
      'Bearbeiten-Dialog wie im Figma, Kamera-Badge am Avatar',
      'Avatar → Schritt „Wähle deinen Avatar“ (wie Registrierung) + „Eigenes Bild hochladen“',
      'E-Mail nur lesbar mit „Ändern“ → eigener Schritt, Link geht sofort raus',
      'Danach Karte „Prüfe dein Postfach“ (wie Verifizierung)',
      'Profil zeigt einen Hinweis-Kasten bis zur Bestätigung',
    ],
  },
  {
    key: 'C',
    name: 'Avatar als Knopf',
    notes: [
      'Klick auf den Avatar: Menü (Desktop) / Bottom-Sheet (mobil)',
      'Foto hochladen · Aus der Liste wählen · Foto entfernen',
      'Desktop: Bild auf den Avatar ziehen, Fortschrittsring',
      'Fehler als rote Pille unter dem Avatar',
      'Geänderte E-Mail: Rückfrage-Dialog beim Speichern, Badge „nicht bestätigt“',
    ],
  },
];

@Component({
  selector: 'app-prototype-profile-edit',
  imports: [PrototypeSwitcher, VariantA, VariantB, VariantC],
  template: `
    <div class="min-h-dvh bg-neutral-200 p-6 pb-24 font-sans">
      <div class="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 class="text-2xl font-bold">Variante {{ current().key }}: {{ current().name }}</h1>
        <span class="text-sm text-text-gray">PROTOTYP · „Bearbeiten“ klicken · Demo-Uploads unten links im Rahmen · Neu laden setzt zurück</span>
      </div>
      <ul class="mb-5 flex flex-wrap gap-2">
        @for (n of current().notes; track n) {
          <li class="rounded-full bg-white px-3 py-1 text-sm">{{ n }}</li>
        }
      </ul>
      <div class="flex items-start gap-6">
        <section class="h-[960px] w-[1100px] shrink-0 overflow-hidden rounded-[30px] shadow">
          @switch (current().key) {
            @case ('A') { <app-variant-a /> }
            @case ('B') { <app-variant-b /> }
            @case ('C') { <app-variant-c /> }
          }
        </section>
        <section class="h-[932px] w-[446px] shrink-0 overflow-hidden rounded-[30px] border-8 border-neutral-800 shadow">
          @switch (current().key) {
            @case ('A') { <app-variant-a [mobile]="true" /> }
            @case ('B') { <app-variant-b [mobile]="true" /> }
            @case ('C') { <app-variant-c [mobile]="true" /> }
          }
        </section>
      </div>
    </div>
    <app-prototype-switcher [variants]="variants" />
  `,
})
export class PrototypeProfileEditPage {
  protected readonly variants = VARIANTS;
  private readonly key = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((p) => p.get('variant'))),
  );
  protected readonly current = computed(
    () => VARIANTS.find((v) => v.key === this.key()) ?? VARIANTS[0],
  );
}
