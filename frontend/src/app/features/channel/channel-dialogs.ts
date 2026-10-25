import { Dialog } from '@angular/cdk/dialog';
import { inject, Service } from '@angular/core';
import { ChannelDetailsData, ChannelDetailsDialog } from './channel-details-dialog';
import { CreateChannelDialog, createChannelNameId } from './create-channel-dialog';

/** Opens the Channel dialogs as overlays. */
@Service()
export class ChannelDialogs {
  private readonly dialog = inject(Dialog);

  /** "Channel erstellen", in two steps: name and description, then the people to add. */
  openCreate(): void {
    this.dialog.open(CreateChannelDialog, { autoFocus: `#${createChannelNameId}` });
  }

  /** The details of the Channel [channelId]: name, description and who created it. */
  openDetails(channelId: number): void {
    this.dialog.open<void, ChannelDetailsData>(ChannelDetailsDialog, { data: { channelId } });
  }
}
