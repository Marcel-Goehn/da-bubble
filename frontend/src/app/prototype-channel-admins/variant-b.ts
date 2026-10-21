// PROTOTYPE: variant B "Verwalten-Modus". The list is grouped into Admins and Mitglieder and read-only until an
// Admin clicks "Verwalten": then each row gets an Admin switch and a remove button. Removal is undoable instead of
// confirmed. Deleting needs the Channel name typed in.
import { Component, input, output, signal } from '@angular/core';
import { ChannelState, ProtoAvatar, ProtoChannel, ProtoChannelInfo, ProtoConfirm, Row } from './prototype-bits';

@Component({
  selector: 'app-b-members',
  imports: [ProtoAvatar],
  template: `
    @let s = state();
    <div class="mb-3 flex items-center">
      <h2 class="text-2xl font-bold">Mitglieder</h2>
      @if (s.iAmAdmin()) {
        <button class="ml-auto text-purple-3 hover:underline" (click)="managing.set(!managing())">{{ managing() ? 'Fertig' : 'Verwalten' }}</button>
      }
      @if (closable()) {
        <button class="material-symbols-outlined ml-4" (click)="close.emit()">close</button>
      }
    </div>
    @for (group of groups(); track group.label) {
      @if (group.rows.length) {
        <h3 class="mt-3 mb-1 px-3 text-sm font-bold tracking-wide text-text-gray uppercase">{{ group.label }} · {{ group.rows.length }}</h3>
        <ul class="flex flex-col">
          @for (r of group.rows; track r.id) {
            <li class="flex items-center gap-4 rounded-full py-1.5 pr-2 pl-3" [class.hover:bg-bg-lavender]="!managing()">
              <app-proto-avatar [row]="r">
                @if (r.isCreator) {
                  <span class="absolute -top-1 -left-1 grid size-6 place-items-center rounded-full bg-[#ffcd3c] text-white shadow" title="Ersteller">
                    <span class="material-symbols-outlined !text-base">star</span>
                  </span>
                }
              </app-proto-avatar>
              <span class="flex flex-1 flex-col leading-tight">
                <span class="text-lg">{{ r.name }}@if (r.isMe) { (Du)}</span>
                @if (r.isCreator) { <span class="text-sm text-text-gray">Hat den Channel erstellt</span> }
              </span>
              @if (managing() && s.canManage(r)) {
                <label class="flex cursor-pointer items-center gap-2 text-sm text-text-gray" title="Admin">
                  Admin
                  <input type="checkbox" class="peer sr-only" [checked]="r.isAdmin" (change)="s.setAdmin(r.id, !r.isAdmin)" />
                  <span class="relative h-6 w-10 rounded-full bg-line transition peer-checked:bg-purple-3 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4"></span>
                </label>
                <button class="grid size-9 place-items-center rounded-full text-danger hover:bg-bg-lavender" title="Aus dem Channel entfernen" (click)="removed.emit(r)">
                  <span class="material-symbols-outlined">person_remove</span>
                </button>
              } @else if (managing() && (r.isCreator || r.isMe)) {
                <span class="text-xs text-text-gray">{{ r.isCreator ? 'bleibt immer Admin' : 'du' }}</span>
              }
            </li>
          }
        </ul>
      }
    }
    @if (s.iAmAdmin()) {
      <button class="mt-3 flex items-center gap-4 rounded-full py-2 pl-5 hover:text-purple-3">
        <span class="material-symbols-outlined grid size-10 place-items-center rounded-full bg-bg-lavender">person_add</span>
        <span class="text-lg">Mitglieder hinzufügen</span>
      </button>
    } @else if (!s.isDefault()) {
      <p class="mt-4 flex items-center gap-2 px-3 text-sm text-text-gray">
        <span class="material-symbols-outlined !text-lg">info</span>Nur Admins können Mitglieder hinzufügen oder entfernen.
      </p>
    }
  `,
})
class BMembers {
  readonly state = input.required<ChannelState>();
  readonly closable = input(false);
  readonly removed = output<Row>();
  readonly close = output();
  protected readonly managing = signal(false);

  protected groups() {
    const rows = this.state().rows();
    if (this.state().isDefault()) return [{ label: 'Alle', rows }];
    return [
      { label: 'Admins', rows: rows.filter((r) => r.isAdmin) },
      { label: 'Mitglieder', rows: rows.filter((r) => !r.isAdmin) },
    ];
  }
}

@Component({
  selector: 'app-variant-b',
  imports: [ProtoChannel, ProtoChannelInfo, ProtoConfirm, BMembers],
  template: `
    @let s = state();
    <app-proto-channel [state]="s" [mobile]="mobile()" (openEdit)="panel.set('edit')" (openMembers)="panel.set('members')">
      @if (!s.gone()) {
        @if (panel() === 'members') {
          <div class="absolute inset-0 z-10" (click)="panel.set(null)"></div>
          <div
            class="absolute z-10 rounded-[30px] rounded-tr-none bg-white p-8 shadow-[0_6px_14px_rgba(0,0,0,0.2)]"
            [class]="mobile() ? 'top-[150px] right-3 left-3' : 'top-[160px] right-12 w-[480px]'"
          >
            <app-b-members [state]="s" [closable]="true" (close)="panel.set(null)" (removed)="remove($event)" />
          </div>
        }
        @if (panel() === 'edit') {
          <div class="absolute inset-0 z-10 bg-black/20" [class.hidden]="mobile()" (click)="panel.set(null)"></div>
          <div
            class="absolute z-10 overflow-y-auto bg-white"
            [class]="mobile() ? 'inset-0 p-5 pb-8' : 'top-[140px] left-[60px] max-h-[760px] w-[870px] rounded-[30px] rounded-tl-none p-10 shadow-xl'"
          >
            <div class="mb-6 flex items-center justify-between">
              <h2 class="flex items-center gap-2 text-2xl font-bold"><span class="material-symbols-outlined !text-3xl">tag</span>{{ s.name() }}</h2>
              <button class="material-symbols-outlined" (click)="panel.set(null)">close</button>
            </div>
            <app-proto-channel-info [state]="s" [mobile]="mobile()" />
            @if (mobile()) {
              <section class="mt-6 rounded-[20px] border border-line p-4">
                <app-b-members [state]="s" (removed)="remove($event)" />
              </section>
            }
            @if (s.canLeave()) {
              <div class="mt-6 flex justify-end">
                <button class="rounded-full bg-purple-3 px-6 py-3 font-bold text-white" (click)="s.leave()">Channel verlassen</button>
              </div>
            }
            @if (s.iAmCreator()) {
              <section class="mt-8 rounded-[20px] border border-danger/40 p-5">
                <p class="font-bold text-danger">Channel löschen</p>
                <p class="mt-1 text-sm text-text-gray">
                  Als Ersteller kannst du den Channel nicht verlassen, nur löschen. Das entfernt ihn mit allen Nachrichten und Dateien für alle.
                </p>
                <button class="mt-4 rounded-full border border-danger px-6 py-2.5 font-bold text-danger hover:bg-danger hover:text-white" (click)="typed.set(''); confirmDelete.set(true)">
                  Channel löschen …
                </button>
              </section>
            }
          </div>
        }
        @if (undo(); as u) {
          <div class="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-full bg-neutral-900 px-5 py-3 whitespace-nowrap text-white shadow-xl">
            {{ u.name }} entfernt
            <button class="font-bold text-purple-2" (click)="undoRemove()">Rückgängig</button>
          </div>
        }
      }
      @if (confirmDelete()) {
        <app-proto-confirm
          [title]="'#' + s.name() + ' löschen?'"
          confirmLabel="Löschen"
          [danger]="true"
          [disabled]="typed().trim() !== s.name()"
          (cancel)="confirmDelete.set(false)"
          (confirm)="s.deleteChannel(); confirmDelete.set(false)"
        >
          <span text>Alle {{ s.rows().length }} Mitglieder verlieren den Channel mit allen Nachrichten, Threads und Dateien. Gib zur Bestätigung den Namen ein.</span>
          <input
            class="mt-4 w-full rounded-full border border-line px-5 py-3 outline-none focus:border-purple-3"
            [placeholder]="s.name()"
            [value]="typed()"
            (input)="typed.set($any($event.target).value)"
          />
        </app-proto-confirm>
      }
    </app-proto-channel>
  `,
})
export class VariantB {
  readonly state = input.required<ChannelState>();
  readonly mobile = input(false);
  protected readonly panel = signal<'members' | 'edit' | null>(null);
  protected readonly confirmDelete = signal(false);
  protected readonly typed = signal('');
  protected readonly undo = signal<{ name: string; m: { id: string; admin: boolean } } | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    this.panel.set(this.mobile() ? 'edit' : 'members');
  }

  protected remove(r: Row) {
    const m = this.state().remove(r.id);
    if (!m) return;
    this.undo.set({ name: r.name, m });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.undo.set(null), 6000);
  }

  protected undoRemove() {
    const u = this.undo();
    if (u) this.state().restore(u.m);
    this.undo.set(null);
  }
}
