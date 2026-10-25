package com.dabubble.backend.message

import io.swagger.v3.oas.annotations.media.Schema
import java.time.Instant
import java.util.UUID

data class MessageDto(
    val id: Long,
    val conversationId: Long,
    val authorId: UUID,
    val parentMessageId: Long?,
    val text: String,
    val createdAt: Instant,
    val editedAt: Instant?,
    val deletedAt: Instant?,
    /** How many Replies its Thread has, Deleted ones included; always 0 for a Reply. */
    val replyCount: Int,
    /** When the newest Reply in its Thread was sent; `null` without one. */
    val lastReplyAt: Instant?,
    /** One entry per emoji, in the order they were first used. */
    val reactions: List<ReactionDto>,
    /** In the order they were sent; none once it's deleted. */
    val attachments: List<AttachmentDto>,
) {
    companion object {
        /** [message] with its Thread's [summary], `null` while it has no Replies, and its [attachments]. */
        fun from(
            message: Message,
            summary: ThreadSummary?,
            attachments: List<AttachmentDto>,
        ) = MessageDto(
            id = checkNotNull(message.id),
            conversationId = message.conversationId,
            authorId = message.authorId,
            parentMessageId = message.parentMessageId,
            text = message.text,
            createdAt = message.createdAt,
            editedAt = message.editedAt,
            deletedAt = message.deletedAt,
            replyCount = summary?.replyCount?.toInt() ?: 0,
            lastReplyAt = summary?.lastReplyAt,
            reactions = ReactionDto.from(message.reactions),
            attachments = attachments,
        )
    }
}

/**
 * A file sent with a Message. Its URLs work for 5 minutes, so they're for showing it; opening or downloading
 * it asks for a fresh URL, which checks access at that moment.
 */
data class AttachmentDto(
    val id: Long,
    /** The original file name. */
    val name: String,
    /** In bytes. */
    val size: Long,
    val contentType: String,
    val url: String,
    /** An image's 320 px thumbnail; `null` for other files, and for an image without one, which shows itself. */
    val thumbnailUrl: String?,
)

/** A fresh URL to open or download an Attachment, which works for 1 minute. */
data class AttachmentUrlDto(
    val url: String,
)

/** Everyone who reacted to a Message with [emoji], in the order they did. */
data class ReactionDto(
    val emoji: String,
    val userIds: List<UUID>,
) {
    companion object {
        fun from(reactions: List<Reaction>): List<ReactionDto> =
            reactions.groupBy { it.emoji }.map { (emoji, group) -> ReactionDto(emoji, group.map { it.userId }) }
    }
}

/** One page of a Conversation, newest first; [nextCursor] asks for the older page, `null` at the beginning. */
data class MessagePageDto(
    val messages: List<MessageDto>,
    val nextCursor: String?,
)

/**
 * One page of a Thread's Replies, newest first, with its [parent] Message as it is now; [nextCursor] asks for
 * the older page, `null` at the first Reply.
 */
data class ThreadPageDto(
    val parent: MessageDto,
    val replies: List<MessageDto>,
    val nextCursor: String?,
)

/** A Thread as its parent Message shows it, after a Reply was added to it. */
data class ThreadSummaryDto(
    val parentMessageId: Long,
    val replyCount: Int,
    val lastReplyAt: Instant,
)

data class SendMessageRequest(
    /** May be blank if it has Attachments. */
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val text: String,
    /** The User's own Pending Uploads, uploaded and not yet used, to send as its Attachments; at most 5. */
    val attachmentIds: List<Long> = emptyList(),
)

data class EditMessageRequest(
    /** May be blank if the Message has Attachments. */
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val text: String,
)

data class ToggleReactionRequest(
    /** One emoji as native Unicode, skin tone included. */
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val emoji: String,
)
