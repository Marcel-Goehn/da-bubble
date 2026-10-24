package com.dabubble.backend.message

import com.dabubble.backend.conversation.ConversationRepository
import com.dabubble.backend.conversation.requireVisibleTo
import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import com.dabubble.backend.realtime.MessageCreatedEvent
import com.dabubble.backend.realtime.RealtimePublisher
import com.dabubble.backend.time.now
import com.dabubble.backend.user.User
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.data.domain.Limit
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
import java.time.Clock

@RestController
@RequestMapping("/api/conversations/{conversationId}/messages")
@Tag(name = "messages")
class MessageController(
    private val conversations: ConversationRepository,
    private val messages: MessageRepository,
    private val realtime: RealtimePublisher,
    private val clock: Clock,
) {
    /** A page of the Conversation's Messages, newest first; without a cursor the newest page. */
    @GetMapping
    fun listMessages(
        user: User,
        @PathVariable conversationId: Long,
        @RequestParam(required = false) cursor: String?,
    ): MessagePageDto {
        conversations.requireVisibleTo(conversationId, user.id)
        // One more than a page tells whether there is an older one.
        val limit = Limit.of(PAGE_SIZE + 1)
        val found =
            if (cursor == null) {
                messages.findNewest(conversationId, limit)
            } else {
                val position =
                    MessageCursor.decode(cursor) ?: throw ProblemException(ProblemCode.BAD_REQUEST, "Unknown cursor")
                messages.findOlder(conversationId, position.createdAt, position.id, limit)
            }
        val page = found.take(PAGE_SIZE)
        val oldest = page.lastOrNull()?.takeIf { found.size > PAGE_SIZE }
        val nextCursor = oldest?.let { MessageCursor(it.createdAt, checkNotNull(it.id)).encode() }
        return MessagePageDto(page.map(MessageDto::from), nextCursor)
    }

    @PostMapping
    @Transactional
    @ResponseStatus(HttpStatus.CREATED)
    fun sendMessage(
        user: User,
        @PathVariable conversationId: Long,
        @RequestBody request: SendMessageRequest,
    ): MessageDto {
        val conversation = conversations.requireVisibleTo(conversationId, user.id)
        val message = MessageDto.from(messages.save(Message.send(conversationId, user.id, request.text, clock.now())))
        realtime.toUsers(conversation.recipients(), MessageCreatedEvent(message))
        return message
    }

    private companion object {
        const val PAGE_SIZE = 50
    }
}
