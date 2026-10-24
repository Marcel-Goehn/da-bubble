package com.dabubble.backend.realtime

import com.dabubble.backend.conversation.ConversationDto
import com.dabubble.backend.message.MessageDto
import com.dabubble.backend.message.ThreadSummaryDto
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import io.swagger.v3.oas.annotations.media.DiscriminatorMapping
import io.swagger.v3.oas.annotations.media.Schema
import java.util.UUID

/**
 * What the server pushes over STOMP, discriminated on `type`: after a write commits, with the same full DTO
 * the REST API returns, or when a User's Presence changes. The spec publishes the union, so the frontend gets
 * it typed (ADR 0004).
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXISTING_PROPERTY, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(MessageCreatedEvent::class, name = MessageCreatedEvent.TYPE),
    JsonSubTypes.Type(MessageUpdatedEvent::class, name = MessageUpdatedEvent.TYPE),
    JsonSubTypes.Type(ConversationUpsertedEvent::class, name = ConversationUpsertedEvent.TYPE),
    JsonSubTypes.Type(PresenceChangedEvent::class, name = PresenceChangedEvent.TYPE),
)
@Schema(
    oneOf = [
        MessageCreatedEvent::class,
        MessageUpdatedEvent::class,
        ConversationUpsertedEvent::class,
        PresenceChangedEvent::class,
    ],
    discriminatorProperty = "type",
    discriminatorMapping = [
        DiscriminatorMapping(MessageCreatedEvent.TYPE, schema = MessageCreatedEvent::class),
        DiscriminatorMapping(MessageUpdatedEvent.TYPE, schema = MessageUpdatedEvent::class),
        DiscriminatorMapping(ConversationUpsertedEvent.TYPE, schema = ConversationUpsertedEvent::class),
        DiscriminatorMapping(PresenceChangedEvent.TYPE, schema = PresenceChangedEvent::class),
    ],
)
sealed interface RealtimeEvent {
    val type: String
}

/** A new Message in a Conversation; for a Reply, [thread] is its parent's Thread with the Reply counted. */
data class MessageCreatedEvent(
    val message: MessageDto,
    val thread: ThreadSummaryDto?,
) : RealtimeEvent {
    @get:Schema(allowableValues = [TYPE])
    override val type get() = TYPE

    companion object {
        const val TYPE = "message.created"
    }
}

/** A Message was edited or deleted; [message] is as it is now. */
data class MessageUpdatedEvent(
    val message: MessageDto,
) : RealtimeEvent {
    @get:Schema(allowableValues = [TYPE])
    override val type get() = TYPE

    companion object {
        const val TYPE = "message.updated"
    }
}

/**
 * A Conversation appeared in the recipient's sidebar or changed there, e.g. its last activity was bumped. The
 * [conversation] is as the recipient sees it: a DM's partner is the other User.
 */
data class ConversationUpsertedEvent(
    val conversation: ConversationDto,
) : RealtimeEvent {
    @get:Schema(allowableValues = [TYPE])
    override val type get() = TYPE

    companion object {
        const val TYPE = "conversation.upserted"
    }
}

/** A User went online or offline; sent to the whole Workspace. */
data class PresenceChangedEvent(
    val userId: UUID,
    val online: Boolean,
) : RealtimeEvent {
    @get:Schema(allowableValues = [TYPE])
    override val type get() = TYPE

    companion object {
        const val TYPE = "presence.changed"
    }
}
