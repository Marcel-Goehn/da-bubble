package com.dabubble.backend.message

import com.dabubble.backend.attachment.AttachmentUrls
import org.springframework.stereotype.Component

/** Messages as clients see them: with their Threads' reply counts and presigned URLs for their Attachments. */
@Component
class MessageViews(
    private val messages: MessageRepository,
    private val attachmentUrls: AttachmentUrls,
) {
    fun toDtos(messages: List<Message>): List<MessageDto> {
        val summaries =
            if (messages.isEmpty()) {
                emptyMap()
            } else {
                this.messages.summarizeThreads(messages.map { checkNotNull(it.id) }).associateBy { it.parentMessageId }
            }
        return messages.map { toDto(it, summaries[it.id]) }
    }

    fun toDto(message: Message): MessageDto = toDtos(listOf(message)).single()

    /** [message] with its Thread's [summary], `null` while it has no Replies, as for a new one. */
    fun toDto(
        message: Message,
        summary: ThreadSummary?,
    ): MessageDto = MessageDto.from(message, summary, message.attachments.map(attachmentUrls::toDto))
}
