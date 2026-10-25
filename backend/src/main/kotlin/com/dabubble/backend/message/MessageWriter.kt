package com.dabubble.backend.message

import com.dabubble.backend.attachment.PendingUploads
import com.dabubble.backend.conversation.Conversation
import com.dabubble.backend.conversation.ConversationDto
import com.dabubble.backend.conversation.ConversationRepository
import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import com.dabubble.backend.realtime.ConversationUpsertedEvent
import com.dabubble.backend.realtime.MessageCreatedEvent
import com.dabubble.backend.realtime.MessageUpdatedEvent
import com.dabubble.backend.realtime.RealtimeEvent
import com.dabubble.backend.realtime.RealtimePublisher
import com.dabubble.backend.time.now
import com.dabubble.backend.user.UserRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.util.UUID

/**
 * Sends, replies to, edits, deletes and reacts to Messages in a Conversation the User can see. Each write bumps
 * the Conversation's last activity and tells its Users once committed.
 */
@Component
class MessageWriter(
    private val messages: MessageRepository,
    private val views: MessageViews,
    private val pendingUploads: PendingUploads,
    private val conversations: ConversationRepository,
    private val users: UserRepository,
    private val realtime: RealtimePublisher,
    private val clock: Clock,
) {
    @Transactional
    fun send(
        conversation: Conversation,
        authorId: UUID,
        text: String,
        attachmentIds: List<Long>,
    ): MessageDto {
        val conversationId = checkNotNull(conversation.id)
        val now = clock.now()
        val attachments = pendingUploads.useAsAttachments(authorId, attachmentIds)
        val sent = Message.send(conversationId, authorId, text, mentionsIn(text), attachments, now)
        val message = views.toDto(messages.save(sent), null)
        announce(conversation, now, MessageCreatedEvent(message, null))
        return message
    }

    /**
     * Sends a Reply in the Thread of the Message [parentId] in [conversation]. The parent stays locked until
     * the commit, so concurrent Replies count one after the other and each event carries an exact count.
     */
    @Transactional
    fun reply(
        conversation: Conversation,
        parentId: Long,
        authorId: UUID,
        text: String,
        attachmentIds: List<Long>,
    ): MessageDto {
        val conversationId = checkNotNull(conversation.id)
        val now = clock.now()
        val parent = messages.requireLockedIn(conversationId, parentId)
        val attachments = pendingUploads.useAsAttachments(authorId, attachmentIds)
        val sent = Message.reply(parent, authorId, text, mentionsIn(text), attachments, now)
        val reply = views.toDto(messages.save(sent), null)
        val thread = messages.summarizeThreads(listOf(parentId)).single().toDto()
        announce(conversation, now, MessageCreatedEvent(reply, thread))
        return reply
    }

    /** Replaces the text of the Message [messageId] in [conversation], which only its author may do. */
    @Transactional
    fun edit(
        conversation: Conversation,
        messageId: Long,
        userId: UUID,
        text: String,
    ): MessageDto {
        val now = clock.now()
        val message = requireMessage(conversation, messageId)
        message.edit(userId, text, mentionsIn(text), now)
        val edited = views.toDto(message)
        announce(conversation, now, MessageUpdatedEvent(edited))
        return edited
    }

    /**
     * Turns the Message [messageId] in [conversation] into a Deleted Message, which only its author may do.
     * Deleting it again changes nothing and tells nobody.
     */
    @Transactional
    fun delete(
        conversation: Conversation,
        messageId: Long,
        userId: UUID,
    ): MessageDto {
        val now = clock.now()
        val message = requireMessage(conversation, messageId)
        val changed = message.delete(userId, now)
        val deleted = views.toDto(message)
        if (changed) {
            announce(conversation, now, MessageUpdatedEvent(deleted))
        }
        return deleted
    }

    /**
     * Adds or removes the User's Reaction with [emoji] on the Message or Reply [messageId] in [conversation]. The
     * Message stays locked until the commit, so two tabs toggling at once take turns.
     */
    @Transactional
    fun toggleReaction(
        conversation: Conversation,
        messageId: Long,
        userId: UUID,
        emoji: String,
    ): MessageDto {
        val conversationId = checkNotNull(conversation.id)
        val now = clock.now()
        val message = messages.requireLockedIn(conversationId, messageId)
        message.toggleReaction(userId, emoji, now)
        val toggled = views.toDto(message)
        announce(conversation, now, MessageUpdatedEvent(toggled))
        return toggled
    }

    /**
     * The Users and Channels [text] mentions. A token for one that doesn't exist, or for a DM, stays in the text
     * but mentions nothing, so it reads as plain text.
     */
    private fun mentionsIn(text: String): Set<MentionTarget> {
        val targets = MentionTokens.targetsIn(text)
        val userIds = targets.filterIsInstance<MentionTarget.User>().map { it.id }
        val channelIds = targets.filterIsInstance<MentionTarget.Channel>().map { it.id }
        val users = if (userIds.isEmpty()) emptySet() else users.findExistingIds(userIds)
        val channels = if (channelIds.isEmpty()) emptySet() else conversations.findChannelIds(channelIds)
        return targets.filterTo(linkedSetOf()) {
            when (it) {
                is MentionTarget.User -> it.id in users
                is MentionTarget.Channel -> it.id in channels
            }
        }
    }

    private fun requireMessage(
        conversation: Conversation,
        messageId: Long,
    ): Message = messages.requireIn(checkNotNull(conversation.id), messageId)

    /** Bumps the last activity of [conversation] to [now], then sends [event] and the bumped Conversation. */
    private fun announce(
        conversation: Conversation,
        now: Instant,
        event: RealtimeEvent,
    ) {
        conversations.bumpActivity(checkNotNull(conversation.id), now)
        conversation.bumpActivity(now)
        val recipients = conversation.recipients()
        realtime.toUsers(recipients, event)
        // Each recipient sees the Conversation from their side.
        recipients.forEach {
            realtime.toUsers(setOf(it), ConversationUpsertedEvent(ConversationDto.from(conversation, it)))
        }
    }
}
