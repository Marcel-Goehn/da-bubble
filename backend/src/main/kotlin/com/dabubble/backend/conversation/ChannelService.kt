package com.dabubble.backend.conversation

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import com.dabubble.backend.realtime.ConversationUpsertedEvent
import com.dabubble.backend.realtime.RealtimePublisher
import com.dabubble.backend.time.now
import com.dabubble.backend.user.UserRepository
import org.hibernate.exception.ConstraintViolationException
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
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
    private val realtime: RealtimePublisher,
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
        val created =
            try {
                conversations.saveAndFlush(channel)
            } catch (ex: DataIntegrityViolationException) {
                if ((ex.cause as? ConstraintViolationException)?.constraintName == CHANNEL_NAME_KEY) {
                    throw ProblemException(ProblemCode.CHANNEL_NAME_TAKEN, "\"${channel.name}\" is taken")
                }
                throw ex
            }
        // A Channel looks the same to each of its Members.
        realtime.toUsers(created.memberIds(), ConversationUpsertedEvent(ConversationDto.from(created, creatorId)))
        return created
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
