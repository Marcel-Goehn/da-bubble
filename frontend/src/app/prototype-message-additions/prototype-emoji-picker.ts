// PROTOTYPE: the real emoji-picker-element (decided picker), German data from the CDN for now.
import { CUSTOM_ELEMENTS_SCHEMA, Component, ElementRef, input, output, viewChild, effect } from '@angular/core';

const loaded = Promise.all([import('emoji-picker-element'), import('emoji-picker-element/i18n/de')]);

@Component({
  selector: 'app-prototype-emoji-picker',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<emoji-picker
    #picker
    locale="de"
    data-source="https://cdn.jsdelivr.net/npm/emoji-picker-element-data@1/de/cldr/data.json"
    [class.w-full]="fill()"
    [style.height]="height()"
    (emoji-click)="picked.emit($any($event).detail.unicode)"
  ></emoji-picker>`,
  styles: `
    emoji-picker {
      --background: #fff;
      --border-color: transparent;
      --button-active-background: #eceefe;
      --button-hover-background: #eceefe;
      --indicator-color: #444df2;
      --input-border-color: #adb0d9;
      --input-border-radius: 9999px;
      --input-font-color: #000;
      --input-padding: 0.4rem 0.9rem;
      --outline-color: #797ef3;
      --category-font-color: #686868;
      --emoji-size: 1.5rem;
      font-family: Nunito, sans-serif;
      display: block;
    }
  `,
})
export class PrototypeEmojiPicker {
  readonly fill = input(false);
  readonly height = input('400px');
  readonly picked = output<string>();
  private readonly picker = viewChild<ElementRef>('picker');

  constructor() {
    effect(async () => {
      const el = this.picker()?.nativeElement;
      if (!el) return;
      const [, de] = await loaded;
      el.i18n = de.default;
    });
  }
}
