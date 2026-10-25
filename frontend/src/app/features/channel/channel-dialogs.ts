import { Dialog } from '@angular/cdk/dialog';
import { createFlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { inject, Injector, Service } from '@angular/core';
import { openAddMembers } from './add-members-dialog';
import { ChannelDetailsData, ChannelDetailsDialog } from './channel-details-dialog';
import { ChannelMembersData, ChannelMembersDialog } from './channel-members-dialog';
import { CreateChannelDialog, createChannelNameId } from './create-channel-dialog';

/** Opens the Channel dialogs as overlays. */
@Service()
export class ChannelDialogs {
  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);

  /** "Channel erstellen", in two steps: name and description, then the people to add. */
  openCreate(): void {
    this.dialog.open(CreateChannelDialog, { autoFocus: `#${createChannelNameId}` });
  }

  /** The details of the Channel [channelId]: name, description, who created it, and leaving it. */
  openDetails(channelId: number): void {
    this.dialog.open<void, ChannelDetailsData>(ChannelDetailsDialog, { data: { channelId } });
  }

  /** The Members of the Channel [channelId], as a popover below [anchor]'s right edge. */
  openMembers(channelId: number, anchor: HTMLElement): void {
    const positionStrategy = createFlexibleConnectedPositionStrategy(this.injector, anchor)
      .withPositions([{ originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' }])
      .withPush(true);
    this.dialog.open<void, ChannelMembersData>(ChannelMembersDialog, {
      data: { channelId },
      positionStrategy,
    });
  }

  /** "Leute hinzufügen" for the Channel [channelId]. */
  openAddMembers(channelId: number): void {
    openAddMembers(this.dialog, channelId);
  }
}
