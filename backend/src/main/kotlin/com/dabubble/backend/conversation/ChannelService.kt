package com.dabubble.backend.conversation

import com.dabubble.backend.message.MessageRepository
import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import com.dabubble.backend.realtime.ConversationRemovedEvent
import com.dabubble.backend.realtime.ConversationUpsertedEvent
import com.dabubble.backend.realtime.RealtimePublisher
import com.dabubble.backend.storage.FileDeletions
import com.dabubble.backend.time.now
import com.dabubble.backend.user.UserRepository
import org.hibernate.exception.ConstraintViolationException
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.util.UUID

/** Who joins a new Channel besides its Creator. */
sealed interface NewMembers {
    /** Everyone in the Default Channel when the Channel is created. */
    data object DefaultChannelMembers : NewMembers

    data class Picked(
        val userIds: Set<UUID>,
    ) : NewMembers
}

/** Channels: created by a User, who becomes their Creator. Each change is pushed to the Members once committed. */
@Service
class ChannelService(
    private val conversations: ConversationRepository,
    private val users: UserRepository,
    private val messages: MessageRepository,
    private val realtime: RealtimePublisher,
    private val files: FileDeletions,
    private val clock: Clock,
) {
    /**
     * Creates the Channel [name] with [creatorId] as its Creator and first Member, joined by the [members]. A name
     * another Channel has, ignoring case, is taken, whether or not the Creator can see that Channel. An unknown
     * picked User is not found, and nothing is created.
     */
    @Transactional
    fun create(
        creatorId: UUID,
        name: String,
        description: String?,
        members: NewMembers,
    ): Conversation {
        val now = clock.now()
        val channel = Conversation.channel(name, description, creatorId, now)
        val memberIds =
            when (members) {
                // Everyone in it at this moment, which is everyone.
                NewMembers.DefaultChannelMembers -> conversations.findDefaultChannel().memberIds()

                is NewMembers.Picked -> members.userIds.also { requireUsers(it) }
            }
        memberIds.forEach { channel.addMember(it, now) }
        return saveAndPublish(channel)
    }

    /**
     * Renames the Channel [channelId] and changes its description, as the Admin [actorId]; a `null` leaves
     * either as it is. A name another Channel has is taken, as for a new one.
     */
    @Transactional
    fun edit(
        channelId: Long,
        actorId: UUID,
        name: String?,
        description: String?,
    ): Conversation {
        val channel = conversations.requireVisibleTo(channelId, actorId)
        channel.edit(actorId, name, description)
        return saveAndPublish(channel)
    }

    /** Adds the Users [userIds] to the Channel [channelId], as the Admin [actorId]. An unknown User is not found. */
    @Transactional
    fun addMembers(
        channelId: Long,
        actorId: UUID,
        userIds: Set<UUID>,
    ): Conversation {
        val channel = conversations.requireVisibleTo(channelId, actorId)
        requireUsers(userIds)
        channel.addMembers(actorId, userIds, clock.now())
        return saveAndPublish(channel)
    }

    /**
     * Removes the Member [userId] from the Channel [channelId], as the Admin [actorId]. They lose it at once; the
     * others see them gone. Returns their Membership as it was, for an undo.
     */
    @Transactional
    fun removeMember(
        channelId: Long,
        actorId: UUID,
        userId: UUID,
    ): Membership {
        val channel = conversations.requireVisibleTo(channelId, actorId)
        val removed = channel.removeMember(actorId, userId)
        saveAndPublish(channel)
        realtime.toUsers(setOf(userId), ConversationRemovedEvent(channelId))
        return removed
    }

    /** The Member [userId] leaves the Channel [channelId]; it's gone for them, and the others see them gone. */
    @Transactional
    fun leave(
        channelId: Long,
        userId: UUID,
    ) {
        val channel = conversations.requireVisibleTo(channelId, userId)
        channel.leave(userId)
        saveAndPublish(channel)
        realtime.toUsers(setOf(userId), ConversationRemovedEvent(channelId))
    }

    /**
     * Deletes the Channel [channelId], as its Creator [actorId]. The database cascades to its Messages, Replies,
     * Reactions, Attachments and Memberships; every Member loses it at once, and its files go in one batch once
     * committed.
     */
    @Transactional
    fun delete(
        channelId: Long,
        actorId: UUID,
    ) {
        val channel = conversations.requireVisibleTo(channelId, actorId)
        channel.requireDeletableBy(actorId)
        val members = channel.memberIds()
        // Locked first, so no Attachment arrives after its files are listed.
        conversations.lock(channelId)
        val fileKeys = messages.findAttachmentsIn(channelId).flatMap { it.objectKeys }
        conversations.deleteConversation(channelId)
        files.deleteAfterCommit(fileKeys)
        realtime.toUsers(members, ConversationRemovedEvent(channelId))
    }

    /** Undoes the removal of [userId] from the Channel [channelId], as the Admin [actorId]. */
    @Transactional
    fun restoreMember(
        channelId: Long,
        actorId: UUID,
        userId: UUID,
        isAdmin: Boolean,
        joinedAt: Instant,
    ): Conversation {
        val channel = conversations.requireVisibleTo(channelId, actorId)
        requireUsers(setOf(userId))
        channel.restoreMember(actorId, userId, isAdmin, joinedAt, clock.now())
        return saveAndPublish(channel)
    }

    /** Grants or revokes Admin for the Member [userId] of the Channel [channelId], as the Admin [actorId]. */
    @Transactional
    fun setAdmin(
        channelId: Long,
        actorId: UUID,
        userId: UUID,
        isAdmin: Boolean,
    ): Conversation {
        val channel = conversations.requireVisibleTo(channelId, actorId)
        channel.setAdmin(actorId, userId, isAdmin)
        return saveAndPublish(channel)
    }

    /** Stores [channel], with a taken name refused, and pushes it to its Members once committed. */
    private fun saveAndPublish(channel: Conversation): Conversation {
        val saved =
            try {
                conversations.saveAndFlush(channel)
            } catch (ex: DataIntegrityViolationException) {
                if ((ex.cause as? ConstraintViolationException)?.constraintName == CHANNEL_NAME_KEY) {
                    throw ProblemException(ProblemCode.CHANNEL_NAME_TAKEN, "\"${channel.name}\" is taken")
                }
                throw ex
            }
        publish(saved, saved.memberIds())
        return saved
    }

    /** Pushes [channel] to the [recipients] once committed; a Channel looks the same to each of them. */
    private fun publish(
        channel: Conversation,
        recipients: Set<UUID>,
    ) {
        val anyone = recipients.firstOrNull() ?: return
        realtime.toUsers(recipients, ConversationUpsertedEvent(ConversationDto.from(channel, anyone)))
    }

    private fun requireUsers(ids: Set<UUID>) {
        val unknown = ids - users.findAllById(ids).mapTo(mutableSetOf()) { it.id }
        if (unknown.isNotEmpty()) {
            throw ProblemException(ProblemCode.NOT_FOUND, "No Users $unknown")
        }
    }

    private companion object {
        // The unique index on lower(name) from V1__init.sql.
        const val CHANNEL_NAME_KEY = "conversations_channel_name_key"
    }
}
