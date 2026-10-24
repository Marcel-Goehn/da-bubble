import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LegalPage } from './legal-page';

/** `/impressum`, public: the operator's details. */
@Component({
  selector: 'app-impressum',
  imports: [LegalPage, TranslocoPipe],
  template: `
    <app-legal-page [heading]="'legal.impressum.title' | transloco">
      <p class="whitespace-pre-line">{{ 'legal.impressum.operator' | transloco }}</p>
      <h2 class="mt-20 text-24 font-bold text-accent lg:text-32">
        {{ 'legal.impressum.contactTitle' | transloco }}
      </h2>
      <p>{{ 'legal.impressum.contact' | transloco }}</p>
    </app-legal-page>
  `,
})
export class Impressum {}
