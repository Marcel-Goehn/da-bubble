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
) {
    companion object {
        /** [message] with its Thread's [summary], `null` while it has no Replies. */
        fun from(
            message: Message,
            summary: ThreadSummary?,
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
        )
    }
}

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
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val text: String,
)

data class EditMessageRequest(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val text: String,
)

data class ToggleReactionRequest(
    /** One emoji as native Unicode, skin tone included. */
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val emoji: String,
)
