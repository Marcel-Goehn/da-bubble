import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IconName, icons } from './icons';

/**
 * A Material Symbol drawn in the current text colour, 24 px by default. Decorative unless it gets a
 * (translated) label, e.g. when it is the only content of a link.
 */
@Component({
  selector: 'app-icon',
  template: '',
  host: {
    class: 'inline-block size-24 shrink-0 fill-current *:size-full',
    '[innerHTML]': 'svg()',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label()',
  },
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly label = input<string>();

  private readonly sanitizer = inject(DomSanitizer);
  // Trusted: the markup is a build-time constant from @material-symbols, never user input.
  protected readonly svg = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(icons[this.name()]),
  );
}
