import { booleanAttribute, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IconName, icons } from './icons';

/**
 * A Material Symbol drawn in the current text colour, 24 px unless it should `fillContainer`.
 * Decorative unless it gets a (translated) label, e.g. when it is the only content of a link.
 */
@Component({
  selector: 'app-icon',
  template: '',
  host: {
    class: 'inline-block shrink-0 fill-current *:size-full',
    '[class.size-24]': '!fillContainer()',
    '[class.size-full]': 'fillContainer()',
    '[innerHTML]': 'svg()',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label()',
  },
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly label = input<string>();
  readonly fillContainer = input(false, { transform: booleanAttribute });

  private readonly sanitizer = inject(DomSanitizer);
  // Trusted: the markup is a build-time constant from @material-symbols, never user input.
  protected readonly svg = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(icons[this.name()]),
  );
}
