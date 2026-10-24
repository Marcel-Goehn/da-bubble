package com.dabubble.backend.conversation

import com.fasterxml.jackson.annotation.JsonProperty
import java.util.UUID

/**
 * A Conversation as a sidebar row. A Channel has its [name] (internal for the Default Channel, which the
 * frontend shows translated); a DM has its [partnerId], the User themselves for a self-DM.
 */
data class ConversationDto(
    val id: Long,
    val kind: ConversationKind,
    val name: String?,
    // Without it, springdoc's introspection drops the `is` that the Kotlin-aware serialiser keeps.
    @get:JsonProperty("isDefault")
    val isDefault: Boolean,
    val partnerId: UUID?,
) {
    companion object {
        fun from(
            conversation: Conversation,
            viewerId: UUID,
        ) = ConversationDto(
            id = checkNotNull(conversation.id),
            kind = conversation.kind,
            name = conversation.name,
            isDefault = conversation.isDefault,
            partnerId = conversation.partnerOf(viewerId),
        )
    }
}
