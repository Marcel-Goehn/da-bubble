package com.dabubble.backend.realtime

import org.springframework.messaging.Message
import org.springframework.messaging.MessagingException
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.MessageBuilder
import org.springframework.web.socket.messaging.StompSubProtocolErrorHandler

/** A frame the server won't accept; its message is what the client reads in the ERROR frame. */
class StompRefusedException(
    message: String,
) : MessagingException(message)

/** Turns a failed client frame into an ERROR frame that names a refusal and says nothing about anything else. */
class StompErrorHandler : StompSubProtocolErrorHandler() {
    override fun handleClientMessageProcessingError(
        clientMessage: Message<ByteArray>?,
        ex: Throwable,
    ): Message<ByteArray> {
        val refusal = generateSequence(ex) { it.cause }.filterIsInstance<StompRefusedException>().firstOrNull()
        val accessor = StompHeaderAccessor.create(StompCommand.ERROR)
        accessor.message = refusal?.message ?: INTERNAL_ERROR
        accessor.setLeaveMutable(true)
        return MessageBuilder.createMessage(ByteArray(0), accessor.messageHeaders)
    }

    private companion object {
        const val INTERNAL_ERROR = "Internal error"
    }
}
