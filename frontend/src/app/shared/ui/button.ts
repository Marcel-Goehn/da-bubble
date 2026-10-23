import { computed, Directive, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary';

const baseClasses =
  'inline-flex items-center justify-center gap-10 rounded-25 border px-25 py-12 text-18 font-bold transition-colors disabled:cursor-not-allowed';

// Component sets 10. and 11. in the Figma (docs/design/tokens.md, "Component states").
const variants: Record<ButtonVariant, string> = {
  primary: `${baseClasses} border-transparent bg-accent text-text-inverse enabled:hover:bg-accent-hover enabled:active:bg-accent disabled:bg-disabled`,
  secondary: `${baseClasses} border-accent-hover bg-surface text-accent enabled:hover:bg-accent-secondary-hover enabled:hover:text-text-inverse enabled:active:bg-accent enabled:active:text-text-inverse disabled:border-disabled disabled:text-disabled`,
};

/** Figma styling for a native button: `<button appButton>` is primary, `appButton="secondary"` secondary. */
@Directive({
  selector: 'button[appButton]',
  host: { '[class]': 'classes()' },
})
export class Button {
  readonly variant = input('primary', {
    alias: 'appButton',
    // A bare `appButton` attribute binds ''.
    transform: (variant: ButtonVariant | '') => variant || 'primary',
  });

  protected readonly classes = computed(() => variants[this.variant()]);
}
