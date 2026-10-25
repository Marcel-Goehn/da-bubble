import { HttpContext } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttachmentsService } from '../../api/generated/attachments/attachments.service';
import { DirectMessagesService } from '../../api/generated/direct-messages/direct-messages.service';
import { MessagesService } from '../../api/generated/messages/messages.service';
import {
  AttachmentDto,
  MessageDto,
  ReactionDto,
  SendMessageRequest,
  ThreadSummaryDto,
} from '../../api/generated/model';
import { ThreadsService } from '../../api/generated/threads/threads.service';
import { ROUTED_READ } from '../errors/error.interceptor';
import { MessageWindow, MessageWindowView } from './message-window';

export type { AttachmentDto, MessageDto, ReactionDto, ThreadSummaryDto };
export type { MessageWindowView };

/** What sends [text] with [attachmentIds]; a Message without Attachments is just its text. */
function sendRequest(text: string, attachmentIds: number[]): SendMessageRequest {
  return attachmentIds.length === 0 ? { text } : { text, attachmentIds };
}

/** A Thread, identified by its parent Message, in that Message's Conversation. */
export interface ThreadKey {
  conversationId: number;
  parentId: number;
}

/**
 * The Messages the User has open: the open Conversation's window of top-level Messages, and the open
 * Thread's window of Replies with its parent. Edits, deletes and new reply counts reach both.
 */
@Service()
export class MessageStore {
  private readonly api = inject(MessagesService);
  private readonly directMessagesApi = inject(DirectMessagesService);
  private readonly threadsApi = inject(ThreadsService);
  private readonly attachmentsApi = inject(AttachmentsService);
  private readonly parentState = signal<MessageDto | null>(null);

  /** The open Conversation's top-level Messages. */
  readonly conversation = new MessageWindow<number>(
    (conversationId, cursor) =>
      firstValueFrom(this.api.listMessages(conversationId, cursor ? { cursor } : undefined)),
    (conversationId, message) =>
      message.conversationId === conversationId && message.parentMessageId === null,
  );

  /** The open Thread's Replies. */
  readonly thread = new MessageWindow<ThreadKey>(
    (key, cursor) => this.fetchThread(key, cursor),
    (key, message) => message.parentMessageId === key.parentId,
  );

  /** The open Thread's parent Message, once its first page has loaded. */
  readonly threadParent = this.parentState.asReadonly();

  /** Replaces the Thread window with the newest Replies of [key] and its parent. */
  openThread(key: ThreadKey): Promise<void> {
    this.parentState.set(null);
    return this.thread.open(key);
  }

  closeThread(): void {
    this.parentState.set(null);
    this.thread.close();
  }

  /** Catches up on both windows; see [MessageWindow.refreshNewest]. */
  async refreshNewest(): Promise<void> {
    await Promise.all([this.conversation.refreshNewest(), this.thread.refreshNewest()]);
  }

  /**
   * Sends [text] with the Pending Uploads [attachmentIds] to [conversationId]; the Message joins the window
   * if that Conversation is still open.
   */
  async send(conversationId: number, text: string, attachmentIds: number[] = []): Promise<void> {
    const sent = await firstValueFrom(
      this.api.sendMessage(conversationId, sendRequest(text, attachmentIds)),
    );
    // Not contiguous: while disconnected, others' Messages before it may be missing.
    this.conversation.merge([sent]);
  }

  /**
   * Sends [text] with the Pending Uploads [attachmentIds] to the DM with [partnerId], which the first Message
   * creates. Returns the sent Message, whose Conversation is that DM.
   */
  async sendDirect(
    partnerId: string,
    text: string,
    attachmentIds: number[] = [],
  ): Promise<MessageDto> {
    const sent = await firstValueFrom(
      this.directMessagesApi.sendDirectMessage(partnerId, sendRequest(text, attachmentIds)),
    );
    this.conversation.merge([sent]);
    return sent;
  }

  /**
   * Replies [text] with the Pending Uploads [attachmentIds] in the Thread of [key]; the Reply joins the
   * window if that Thread is still open. Its parent's reply count follows with the `message.created` echo.
   */
  async sendReply(key: ThreadKey, text: string, attachmentIds: number[] = []): Promise<void> {
    const sent = await firstValueFrom(
      this.threadsApi.sendReply(key.conversationId, key.parentId, sendRequest(text, attachmentIds)),
    );
    this.thread.merge([sent]);
  }

  /** Replaces the text of the User's own [message] with [text]. */
  async edit(message: MessageDto, text: string): Promise<void> {
    this.replace(
      await firstValueFrom(this.api.editMessage(message.conversationId, message.id, { text })),
    );
  }

  /** Deletes the User's own [message] for everyone; it stays as a Deleted Message. */
  async delete(message: MessageDto): Promise<void> {
    this.replace(await firstValueFrom(this.api.deleteMessage(message.conversationId, message.id)));
  }

  /** Fetches [message] again, e.g. once the URLs of its Attachments have expired. */
  async refresh(message: MessageDto): Promise<void> {
    this.replace(await firstValueFrom(this.api.getMessage(message.conversationId, message.id)));
  }

  /**
   * A fresh URL that opens [attachment] of [message] for a minute, or [download]s it whatever its type. The
   * backend checks that the User can still see the Conversation.
   */
  async attachmentUrl(
    message: MessageDto,
    attachment: AttachmentDto,
    download: boolean,
  ): Promise<string> {
    const { url } = await firstValueFrom(
      this.attachmentsApi.getAttachmentUrl(message.conversationId, message.id, attachment.id, {
        download,
      }),
    );
    return url;
  }

  /** Adds the User's Reaction with [emoji] to [message], or removes it if they've reacted with it. */
  async toggleReaction(message: MessageDto, emoji: string): Promise<void> {
    this.replace(
      await firstValueFrom(this.api.toggleReaction(message.conversationId, message.id, { emoji })),
    );
  }

  /**
   * Adds a Message or Reply pushed live; with the connection up, nothing before it was missed. A Reply comes
   * with its parent's [thread] as it is now.
   */
  upsert(message: MessageDto, thread: ThreadSummaryDto | null = null): void {
    this.conversation.merge([message], { contiguous: true });
    this.thread.merge([message], { contiguous: true });
    if (thread !== null) {
      this.applyThread(thread);
    }
  }

  /** Takes an edited or deleted [message] wherever it is held; one that isn't held isn't missed. */
  replace(message: MessageDto): void {
    this.conversation.update(message.id, () => message);
    this.thread.update(message.id, () => message);
    if (this.parentState()?.id === message.id) {
      this.parentState.set(message);
    }
  }

  /**
   * Shows a Thread's new reply count and last reply on its parent. Replies are never removed, so a count
   * lower than the one shown is an event that arrived late, and is ignored.
   */
  private applyThread(thread: ThreadSummaryDto): void {
    const apply = (parent: MessageDto): MessageDto =>
      parent.replyCount > thread.replyCount
        ? parent
        : { ...parent, replyCount: thread.replyCount, lastReplyAt: thread.lastReplyAt };
    this.conversation.update(thread.parentMessageId, apply);
    const parent = this.parentState();
    if (parent?.id === thread.parentMessageId) {
      this.parentState.set(apply(parent));
    }
  }

  /** A page of [key]'s Replies; its parent is taken as it is now while that Thread is still open. */
  private async fetchThread(key: ThreadKey, cursor?: string) {
    // A Thread that's gone or out of reach sends the User away, as its route can't be shown.
    const context = new HttpContext().set(ROUTED_READ, true);
    const page = await firstValueFrom(
      this.threadsApi.listReplies(
        key.conversationId,
        key.parentId,
        cursor ? { cursor } : undefined,
        {
          context,
        },
      ),
    );
    if (this.thread.key() === key) {
      this.parentState.set(page.parent);
    }
    return { messages: page.replies, nextCursor: page.nextCursor };
  }
}
