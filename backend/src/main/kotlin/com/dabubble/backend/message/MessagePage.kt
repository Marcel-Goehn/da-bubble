package com.dabubble.backend.message

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import org.springframework.data.domain.Limit

/** Messages per page, of a Conversation or a Thread. */
private const val PAGE_SIZE = 50

/** One keyset page, newest first, and the cursor for the older page; `null` at the beginning. */
data class MessagePage(
    val messages: List<Message>,
    val nextCursor: String?,
)

/**
 * The page after [cursor], or the newest page without one, from [newest] and [older], which each return up
 * to their limit, newest first. A [cursor] that isn't one of ours is a bad request.
 */
fun keysetPage(
    cursor: String?,
    newest: (Limit) -> List<Message>,
    older: (MessageCursor, Limit) -> List<Message>,
): MessagePage {
    // One more than a page tells whether there is an older one.
    val limit = Limit.of(PAGE_SIZE + 1)
    val found =
        if (cursor == null) {
            newest(limit)
        } else {
            val position =
                MessageCursor.decode(cursor) ?: throw ProblemException(ProblemCode.BAD_REQUEST, "Unknown cursor")
            older(position, limit)
        }
    val page = found.take(PAGE_SIZE)
    val oldest = page.lastOrNull()?.takeIf { found.size > PAGE_SIZE }
    return MessagePage(page, oldest?.let { MessageCursor(it.createdAt, checkNotNull(it.id)).encode() })
}
