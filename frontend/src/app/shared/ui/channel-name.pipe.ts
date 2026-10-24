import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ConversationDto } from '../../core/data/conversation.store';

/**
 * A Channel's shown name. The Default Channel's stored name is internal, so it shows as "Allgemein" or
 * "General" in the active language. Impure, like Transloco's own pipe, to follow language changes.
 */
@Pipe({ name: 'channelName', pure: false })
export class ChannelNamePipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(channel: Pick<ConversationDto, 'name' | 'isDefault'>): string {
    return channel.isDefault ? this.transloco.translate('channel.default') : (channel.name ?? '');
  }
}
