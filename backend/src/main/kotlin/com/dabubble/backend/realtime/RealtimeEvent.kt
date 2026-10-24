package com.dabubble.backend.realtime

import com.dabubble.backend.message.MessageDto
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import io.swagger.v3.oas.annotations.media.DiscriminatorMapping
import io.swagger.v3.oas.annotations.media.Schema

/**
 * What the server pushes over STOMP after a write commits, discriminated on `type`. Each event carries the
 * same full DTO the REST API returns, and the spec publishes the union, so the frontend gets it typed (ADR 0004).
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXISTING_PROPERTY, property = "type")
@JsonSubTypes(JsonSubTypes.Type(MessageCreatedEvent::class, name = MessageCreatedEvent.TYPE))
@Schema(
    oneOf = [MessageCreatedEvent::class],
    discriminatorProperty = "type",
    discriminatorMapping = [DiscriminatorMapping(MessageCreatedEvent.TYPE, schema = MessageCreatedEvent::class)],
)
sealed interface RealtimeEvent {
    val type: String
}

/** A new Message in a Conversation. */
data class MessageCreatedEvent(
    val message: MessageDto,
) : RealtimeEvent {
    @get:Schema(allowableValues = [TYPE])
    override val type get() = TYPE

    companion object {
        const val TYPE = "message.created"
    }
}
