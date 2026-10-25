package com.dabubble.backend.read

/**
 * What the User hasn't read yet: per Conversation the Unread Messages and Replies its sidebar row counts, and
 * per Thread its "N neu". Only those with something Unread are listed.
 */
data class UnreadDto(
    val conversations: List<ConversationUnreadDto>,
    val threads: List<ThreadUnreadDto>,
)

data class ConversationUnreadDto(
    val conversationId: Long,
    val count: Int,
)

/** The Unread Replies in the Thread of the Message [parentMessageId]. */
data class ThreadUnreadDto(
    val conversationId: Long,
    val parentMessageId: Long,
    val count: Int,
)
