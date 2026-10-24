package com.dabubble.backend.message

import com.dabubble.backend.conversation.DirectMessageService
import com.dabubble.backend.user.User
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/** The DM with a User by partner, for `/dm/:userId`, which may not exist before its first Message. */
@RestController
@RequestMapping("/api/direct-messages/{partnerId}/messages")
@Tag(name = "directMessages")
class DirectMessageController(
    private val directMessages: DirectMessageService,
    private val sender: MessageSender,
) {
    /** Sends to the DM with [partnerId]; the first Message creates it. */
    @PostMapping
    @Transactional
    @ResponseStatus(HttpStatus.CREATED)
    fun sendDirectMessage(
        user: User,
        @PathVariable partnerId: UUID,
        @RequestBody request: SendMessageRequest,
    ): MessageDto = sender.send(directMessages.findOrCreate(user.id, partnerId), user.id, request.text)
}
