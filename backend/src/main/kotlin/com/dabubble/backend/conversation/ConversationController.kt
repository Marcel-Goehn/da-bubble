package com.dabubble.backend.conversation

import com.dabubble.backend.user.User
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/conversations")
@Tag(name = "conversations")
class ConversationController(
    private val conversations: ConversationRepository,
) {
    /** The sidebar: the Channels the User is a Member of and their DMs, the self-DM included. */
    @GetMapping
    fun listConversations(user: User): List<ConversationDto> =
        conversations.findVisibleTo(user.id).map { ConversationDto.from(it, user.id) }

    @GetMapping("/{id}")
    fun getConversation(
        user: User,
        @PathVariable id: Long,
    ): ConversationDto = ConversationDto.from(conversations.requireVisibleTo(id, user.id), user.id)
}
