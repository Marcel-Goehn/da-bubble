import { Injectable } from '@angular/core';
import { EmojiPickerLoader, LoadedEmojiPicker } from '../app/shared/ui/emoji-picker-loader';

/** The emoji the fake picker offers, as buttons named by their emoji. */
export const fakePickerEmoji = ['😀', '👍🏽', '🎉'];

/**
 * Stands in for `emoji-picker-element`, which needs IndexedDB and fetches its data: a few buttons that
 * fire the same `emoji-click` event with the emoji's native Unicode.
 */
@Injectable()
export class FakeEmojiPickerLoader extends EmojiPickerLoader {
  override create(): Promise<LoadedEmojiPicker> {
    const element = document.createElement('div');
    for (const unicode of fakePickerEmoji) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = unicode;
      button.addEventListener('click', () =>
        element.dispatchEvent(new CustomEvent('emoji-click', { detail: { unicode } })),
      );
      element.append(button);
    }
    return Promise.resolve({ element, focus: () => element.querySelector('button')?.focus() });
  }
}
