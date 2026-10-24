import { Dialog } from '@angular/cdk/dialog';
import { inject, Service } from '@angular/core';
import { ProfileCard, ProfileCardData } from './profile-card';

/** Opens Users' profile cards as an overlay, wherever a User is shown. */
@Service()
export class ProfileCards {
  private readonly dialog = inject(Dialog);

  /** Shows the card of the User [userId]: another User's, or the logged-in User's own. */
  open(userId: string): void {
    this.dialog.open<void, ProfileCardData>(ProfileCard, { data: { userId } });
  }
}
