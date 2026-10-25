package com.dabubble.backend.message

import com.dabubble.backend.conversation.ConversationRepository
import com.dabubble.backend.conversation.requireVisibleTo
import com.dabubble.backend.user.User
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/conversations/{conversationId}/messages")
@Tag(name = "messages")
class MessageController(
    private val conversations: ConversationRepository,
    private val messages: MessageRepository,
    private val views: MessageViews,
    private val writer: MessageWriter,
) {
    /** A page of the Conversation's Messages, newest first; without a cursor the newest page. */
    @GetMapping
    @Transactional(readOnly = true)
    fun listMessages(
        user: User,
        @PathVariable conversationId: Long,
        @RequestParam(required = false) cursor: String?,
    ): MessagePageDto {
        conversations.requireVisibleTo(conversationId, user.id)
        val page =
            keysetPage(
                cursor,
                newest = { messages.findNewest(conversationId, it) },
                older = { position, limit ->
                    messages.findOlder(conversationId, position.createdAt, position.id, limit)
                },
            )
        return MessagePageDto(views.toDtos(page.messages), page.nextCursor)
    }

    /** One Message or Reply as it is now, e.g. once the URLs of its Attachments have expired. */
    @GetMapping("/{messageId}")
    @Transactional(readOnly = true)
    fun getMessage(
        user: User,
        @PathVariable conversationId: Long,
        @PathVariable messageId: Long,
    ): MessageDto {
        conversations.requireVisibleTo(conversationId, user.id)
        return views.toDto(messages.requireIn(conversationId, messageId))
    }

    @PostMapping
    @Transactional
    @ResponseStatus(HttpStatus.CREATED)
    fun sendMessage(
        user: User,
        @PathVariable conversationId: Long,
        @RequestBody request: SendMessageRequest,
    ): MessageDto =
        writer.send(
            conversations.requireVisibleTo(conversationId, user.id),
            user.id,
            request.text,
            request.attachmentIds,
        )

    /** Replaces the text of the User's own Message and marks it edited. */
    @PutMapping("/{messageId}")
    @Transactional
    fun editMessage(
        user: User,
        @PathVariable conversationId: Long,
        @PathVariable messageId: Long,
        @RequestBody request: EditMessageRequest,
    ): MessageDto {
        val conversation = conversations.requireVisibleTo(conversationId, user.id)
        return writer.edit(conversation, messageId, user.id, request.text)
    }

    /** Deletes the User's own Message for everyone; it stays as a Deleted Message. Can't be undone. */
    @DeleteMapping("/{messageId}")
    @Transactional
    fun deleteMessage(
        user: User,
        @PathVariable conversationId: Long,
        @PathVariable messageId: Long,
    ): MessageDto = writer.delete(conversations.requireVisibleTo(conversationId, user.id), messageId, user.id)

    /**
     * Adds the User's Reaction with the emoji to a Message or Reply, or removes it if they've reacted with it
     * already. A Deleted Message can't be reacted to.
     */
    @PostMapping("/{messageId}/reactions")
    @Transactional
    fun toggleReaction(
        user: User,
        @PathVariable conversationId: Long,
        @PathVariable messageId: Long,
        @RequestBody request: ToggleReactionRequest,
    ): MessageDto {
        val conversation = conversations.requireVisibleTo(conversationId, user.id)
        return writer.toggleReaction(conversation, messageId, user.id, request.emoji)
    }
}
