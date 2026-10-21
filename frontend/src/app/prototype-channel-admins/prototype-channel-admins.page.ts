// PROTOTYPE: three variants of the Channel Admin controls, switchable via ?variant= on /prototype/channel-admins.
// Each variant renders a desktop frame and a 430px mobile frame side by side, sharing one in-memory Channel.
// The scenario bar picks who Frederik ("Du") is: Creator, Admin or plain Member, or the Default Channel "Allgemein".
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { PrototypeSwitcher, PrototypeVariant } from '../shared/prototype-switcher';
import { ChannelState, Role } from './prototype-bits';
import { VariantA } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';

const VARIANTS: (PrototypeVariant & { notes: string[] })[] = [
  {
    key: 'A',
    name: 'Zeilenmenü',
    notes: [
      '„Ersteller“ / „Admin“ grau am Zeilenende',
      'Admins: ⋮ pro Zeile (Desktop bei Hover) → Admin geben/entziehen · Entfernen',
      'Entfernen und Löschen mit Bestätigungsdialog',
      'Ersteller: roter Knopf „Channel löschen“ statt „Channel verlassen“',
    ],
  },
  {
    key: 'B',
    name: 'Verwalten-Modus',
    notes: [
      'Liste gruppiert: Admins · Mitglieder, Ersteller mit Stern',
      '„Verwalten“ schaltet Admin-Schalter und Entfernen-Knopf frei',
      'Entfernen sofort, mit „Rückgängig“ statt Rückfrage',
      'Ersteller: eigener Bereich „Channel löschen“, Name eintippen',
      'Nicht-Admins sehen einen Hinweis',
    ],
  },
  {
    key: 'C',
    name: 'Über das Profil',
    notes: [
      'Liste wie im Figma, Rolle als Untertitel',
      'Klick auf ein Mitglied → Profilkarte mit Abschnitt „In #Channel“',
      'Dort Admin geben/entziehen und Entfernen (Rückfrage in der Karte)',
      'Ersteller: umrandeter Knopf „Channel löschen“, Häkchen zur Bestätigung',
    ],
  },
];

const SCENARIOS: { label: string; role: Role; isDefault: boolean }[] = [
  { label: 'Du bist Ersteller', role: 'creator', isDefault: false },
  { label: 'Du bist Admin', role: 'admin', isDefault: false },
  { label: 'Du bist Mitglied', role: 'member', isDefault: false },
  { label: '„Allgemein“', role: 'member', isDefault: true },
];

@Component({
  selector: 'app-prototype-channel-admins',
  imports: [PrototypeSwitcher, VariantA, VariantB, VariantC],
  template: `
    <div class="min-h-dvh bg-neutral-200 p-6 pb-24 font-sans">
      <div class="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h1 class="text-2xl font-bold">Variante {{ current().key }}: {{ current().name }}</h1>
        <span class="text-sm text-text-gray">PROTOTYP · „# Entwicklerteam ⌄“ öffnet den Channel, die Avatare die Mitglieder · Neu laden setzt zurück</span>
      </div>
      <ul class="mb-3 flex flex-wrap gap-2">
        @for (n of current().notes; track n) {
          <li class="rounded-full bg-white px-3 py-1 text-sm">{{ n }}</li>
        }
      </ul>
      <div class="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-neutral-400 bg-white/80 px-3 py-2 font-mono text-xs">
        <span class="text-neutral-500">Szenario:</span>
        @for (sc of scenarios; track sc.label) {
          <button
            class="rounded px-2 py-0.5"
            [class]="isScenario(sc) ? 'bg-neutral-900 text-white' : 'bg-neutral-200 hover:bg-neutral-300'"
            (click)="state.setScenario(sc.role, sc.isDefault)"
          >{{ sc.label }}</button>
        }
        <button class="rounded bg-neutral-200 px-2 py-0.5 hover:bg-neutral-300" (click)="state.reset()">zurücksetzen</button>
        @if (state.log().length) {
          <span class="ml-2 text-neutral-500">Log: {{ state.log().join(' · ') }}</span>
        }
      </div>
      <div class="flex items-start gap-6">
        <section class="relative h-[960px] w-[1100px] shrink-0 overflow-hidden rounded-[30px] shadow">
          @switch (current().key) {
            @case ('A') { <app-variant-a [state]="state" /> }
            @case ('B') { <app-variant-b [state]="state" /> }
            @case ('C') { <app-variant-c [state]="state" /> }
          }
        </section>
        <section class="relative h-[932px] w-[446px] shrink-0 overflow-hidden rounded-[30px] border-8 border-neutral-800 shadow">
          @switch (current().key) {
            @case ('A') { <app-variant-a [state]="state" [mobile]="true" /> }
            @case ('B') { <app-variant-b [state]="state" [mobile]="true" /> }
            @case ('C') { <app-variant-c [state]="state" [mobile]="true" /> }
          }
        </section>
      </div>
    </div>
    <app-prototype-switcher [variants]="variants" />
  `,
})
export class PrototypeChannelAdminsPage {
  protected readonly variants = VARIANTS;
  protected readonly scenarios = SCENARIOS;
  protected readonly state = new ChannelState();
  private readonly key = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((p) => p.get('variant'))),
  );
  protected readonly current = computed(
    () => VARIANTS.find((v) => v.key === this.key()) ?? VARIANTS[0],
  );

  protected isScenario(sc: (typeof SCENARIOS)[number]) {
    return this.state.isDefault() === sc.isDefault && (sc.isDefault || this.state.role() === sc.role);
  }
}
