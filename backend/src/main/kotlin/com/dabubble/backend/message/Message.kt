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

    /** Replaces the text and sets edited at; only the author may, and not once it's deleted. */
    fun edit(
        userId: UUID,
        text: String,
        at: Instant,
    ) {
        requireAuthor(userId)
        if (deletedAt != null) {
            throw ProblemException(ProblemCode.MESSAGE_DELETED, "A Deleted Message can't be edited")
        }
        // TODO(#66): may be blank once it has Attachments.
        if (text.isBlank()) {
            throw ProblemException(ProblemCode.MESSAGE_EMPTY, "A Message needs text or an Attachment")
        }
        this.text = text
        editedAt = at
    }

    /**
     * Makes it a Deleted Message: its content is erased, its place, author and time stay. Only the author may.
     * Returns whether anything changed, which it doesn't for one deleted already.
     * TODO(#59, #66): erase its Mentions, Reactions and Attachments once they exist.
     */
    fun delete(
        userId: UUID,
        at: Instant,
    ): Boolean {
        requireAuthor(userId)
        if (deletedAt != null) {
            return false
        }
        text = ""
        deletedAt = at
        return true
    }

    private fun requireAuthor(userId: UUID) {
        if (userId != authorId) {
            throw ProblemException(ProblemCode.NOT_MESSAGE_AUTHOR, "Only its author may change a Message")
        }
    }

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
