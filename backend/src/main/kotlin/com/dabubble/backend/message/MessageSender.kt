package com.dabubble.backend.message

import com.dabubble.backend.conversation.Conversation
import com.dabubble.backend.conversation.ConversationDto
import com.dabubble.backend.conversation.ConversationRepository
import com.dabubble.backend.realtime.ConversationUpsertedEvent
import com.dabubble.backend.realtime.MessageCreatedEvent
import com.dabubble.backend.realtime.RealtimePublisher
import com.dabubble.backend.time.now
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.util.UUID

/**
 * Posts a Message to a Conversation the author can see, bumps its last activity, and tells its Users once
 * committed.
 */
@Component
class MessageSender(
    private val messages: MessageRepository,
    private val conversations: ConversationRepository,
    private val realtime: RealtimePublisher,
    private val clock: Clock,
) {
    @Transactional
    fun send(
        conversation: Conversation,
        authorId: UUID,
        text: String,
    ): MessageDto {
        val conversationId = checkNotNull(conversation.id)
        val now = clock.now()
        val message = MessageDto.from(messages.save(Message.send(conversationId, authorId, text, now)))
        conversations.bumpActivity(conversationId, now)
        conversation.bumpActivity(now)
        val recipients = conversation.recipients()
        realtime.toUsers(recipients, MessageCreatedEvent(message))
        // Each recipient sees the Conversation from their side.
        recipients.forEach {
            realtime.toUsers(setOf(it), ConversationUpsertedEvent(ConversationDto.from(conversation, it)))
        }
        return message
    }
}
