import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LegalPage } from './legal-page';

/** `/datenschutz`, public: what DA Bubble stores and why. */
@Component({
  selector: 'app-datenschutz',
  imports: [LegalPage, TranslocoPipe],
  template: `
    <app-legal-page [heading]="'legal.datenschutz.title' | transloco">
      <section class="flex flex-col gap-10">
        <h2 class="text-24 font-bold text-accent">
          {{ 'legal.datenschutz.controllerTitle' | transloco }}
        </h2>
        <p>{{ 'legal.datenschutz.controllerText' | transloco }}</p>
      </section>
      <section class="flex flex-col gap-10">
        <h2 class="text-24 font-bold text-accent">
          {{ 'legal.datenschutz.dataTitle' | transloco }}
        </h2>
        <p>{{ 'legal.datenschutz.dataText' | transloco }}</p>
      </section>
      <section class="flex flex-col gap-10">
        <h2 class="text-24 font-bold text-accent">
          {{ 'legal.datenschutz.loginTitle' | transloco }}
        </h2>
        <p>{{ 'legal.datenschutz.loginText' | transloco }}</p>
      </section>
      <section class="flex flex-col gap-10">
        <h2 class="text-24 font-bold text-accent">
          {{ 'legal.datenschutz.storageTitle' | transloco }}
        </h2>
        <p>{{ 'legal.datenschutz.storageText' | transloco }}</p>
      </section>
      <section class="flex flex-col gap-10">
        <h2 class="text-24 font-bold text-accent">
          {{ 'legal.datenschutz.rightsTitle' | transloco }}
        </h2>
        <p>{{ 'legal.datenschutz.rightsText' | transloco }}</p>
      </section>
    </app-legal-page>
  `,
})
export class Datenschutz {}
