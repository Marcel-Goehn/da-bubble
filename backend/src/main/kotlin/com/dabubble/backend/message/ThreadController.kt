package com.dabubble.backend.message

import com.dabubble.backend.conversation.ConversationRepository
import com.dabubble.backend.conversation.requireVisibleTo
import com.dabubble.backend.user.User
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/** The Thread of a Message, identified by that Message: its Replies, one level deep. */
@RestController
@RequestMapping("/api/conversations/{conversationId}/messages/{messageId}/replies")
@Tag(name = "threads")
class ThreadController(
    private val conversations: ConversationRepository,
    private val messages: MessageRepository,
    private val writer: MessageWriter,
) {
    /** A page of the Thread's Replies, newest first, with its parent; without a cursor the newest page. */
    @GetMapping
    @Transactional(readOnly = true)
    fun listReplies(
        user: User,
        @PathVariable conversationId: Long,
        @PathVariable messageId: Long,
        @RequestParam(required = false) cursor: String?,
    ): ThreadPageDto {
        conversations.requireVisibleTo(conversationId, user.id)
        val parent = messages.requireIn(conversationId, messageId)
        parent.requireThreadable()
        val page =
            keysetPage(
                cursor,
                newest = { messages.findNewestReplies(messageId, it) },
                older = { position, limit ->
                    messages.findOlderReplies(messageId, position.createdAt, position.id, limit)
                },
            )
        return ThreadPageDto(messages.toDto(parent), messages.toDtos(page.messages), page.nextCursor)
    }

    /** Replies in the Thread of the Message [messageId], which may be deleted but not a Reply itself. */
    @PostMapping
    @Transactional
    @ResponseStatus(HttpStatus.CREATED)
    fun sendReply(
        user: User,
        @PathVariable conversationId: Long,
        @PathVariable messageId: Long,
        @RequestBody request: SendMessageRequest,
    ): MessageDto {
        val conversation = conversations.requireVisibleTo(conversationId, user.id)
        return writer.reply(conversation, messageId, user.id, request.text)
    }
}
