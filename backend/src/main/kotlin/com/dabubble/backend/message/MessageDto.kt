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
) {
    companion object {
        fun from(message: Message) =
            MessageDto(
                id = checkNotNull(message.id),
                conversationId = message.conversationId,
                authorId = message.authorId,
                parentMessageId = message.parentMessageId,
                text = message.text,
                createdAt = message.createdAt,
                editedAt = message.editedAt,
                deletedAt = message.deletedAt,
            )
    }
}

/** One page of a Conversation, newest first; [nextCursor] asks for the older page, `null` at the beginning. */
data class MessagePageDto(
    val messages: List<MessageDto>,
    val nextCursor: String?,
)

data class SendMessageRequest(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val text: String,
)

data class EditMessageRequest(
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val text: String,
)
