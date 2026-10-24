package com.dabubble.backend.message

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/** The Message aggregate: a post by a User in a Conversation, or a Reply in a Thread (ADR 0002). */
@Entity
@Table(name = "messages")
class Message private constructor(
    val conversationId: Long,
    val authorId: UUID,
    val parentMessageId: Long?,
    var text: String,
    val createdAt: Instant,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    var editedAt: Instant? = null

    var deletedAt: Instant? = null

    companion object {
        /** A new top-level Message. TODO(#66): may be blank once it has Attachments. */
        fun send(
            conversationId: Long,
            authorId: UUID,
            text: String,
            createdAt: Instant,
        ): Message {
            if (text.isBlank()) {
                throw ProblemException(ProblemCode.MESSAGE_EMPTY, "A Message needs text or an Attachment")
            }
            return Message(conversationId, authorId, null, text, createdAt)
        }
    }
}
