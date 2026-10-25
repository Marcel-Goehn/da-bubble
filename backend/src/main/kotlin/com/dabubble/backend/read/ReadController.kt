package com.dabubble.backend.read

import com.dabubble.backend.conversation.ConversationRepository
import com.dabubble.backend.conversation.requireVisibleTo
import com.dabubble.backend.message.MessageRepository
import com.dabubble.backend.message.requireIn
import com.dabubble.backend.user.User
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/conversations")
@Tag(name = "reads")
class ReadController(
    private val conversations: ConversationRepository,
    private val messages: MessageRepository,
    private val unread: UnreadCounts,
    private val markers: ReadMarkers,
) {
    /** The sidebar's unread counts and each Thread's "N neu"; the client derives them live from here on. */
    @GetMapping("/unread")
    @Transactional(readOnly = true)
    fun listUnread(user: User): UnreadDto = unread.of(user.id)

    /** The User has read the Conversation up to now: its count clears in every tab, its Threads' "N neu" stay. */
    @PutMapping("/{conversationId}/read")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun markConversationRead(
        user: User,
        @PathVariable conversationId: Long,
    ) {
        conversations.requireVisibleTo(conversationId, user.id)
        markers.markConversationRead(user.id, conversationId)
    }

    /** The User has read the Thread of the Message [messageId] up to now: its "N neu" clears in every tab. */
    @PutMapping("/{conversationId}/messages/{messageId}/replies/read")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun markThreadRead(
        user: User,
        @PathVariable conversationId: Long,
        @PathVariable messageId: Long,
    ) {
        conversations.requireVisibleTo(conversationId, user.id)
        messages.requireIn(conversationId, messageId).requireThreadable()
        markers.markThreadRead(user.id, conversationId, messageId)
    }
}
