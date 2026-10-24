package com.dabubble.backend.realtime

import com.dabubble.backend.user.CurrentUserService
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtException
import org.springframework.stereotype.Component
import java.security.Principal
import java.util.UUID

/** The User a STOMP session belongs to; its name is their id, which `/user/...` destinations address. */
data class StompUser(
    val id: UUID,
) : Principal {
    override fun getName(): String = id.toString()
}

/**
 * Authenticates a STOMP session from the bearer token in its CONNECT frame, with the same decoder and rules
 * as REST, resolves its User and has the session closed when the token expires. The WebSocket handshake
 * itself carries no token.
 */
@Component
class StompAuthInterceptor(
    private val jwtDecoder: JwtDecoder,
    private val currentUsers: CurrentUserService,
    private val sessions: RealtimeSessions,
) : ChannelInterceptor {
    override fun preSend(
        message: Message<*>,
        channel: MessageChannel,
    ): Message<*> {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java) ?: return message
        when (accessor.command) {
            StompCommand.CONNECT -> {
                val jwt = authenticate(accessor)
                accessor.user = StompUser(currentUsers.resolve(jwt).id)
                jwt.expiresAt?.let { sessions.closeAt(checkNotNull(accessor.sessionId), it) }
            }

            // Translated user destinations (`/queue/events-user…`) belong to other sessions.
            StompCommand.SUBSCRIBE -> {
                if (accessor.destination !in SUBSCRIBABLE) throw StompRefusedException(FORBIDDEN)
            }

            // Every User action is a REST write; nobody publishes to the broker.
            StompCommand.SEND -> {
                throw StompRefusedException(FORBIDDEN)
            }

            else -> {
                Unit
            }
        }
        return message
    }

    private fun authenticate(accessor: StompHeaderAccessor): Jwt {
        val token =
            accessor.getFirstNativeHeader(AUTHORIZATION)?.removePrefix(BEARER)
                ?: throw StompRefusedException(UNAUTHENTICATED)
        return try {
            jwtDecoder.decode(token)
        } catch (_: JwtException) {
            throw StompRefusedException(UNAUTHENTICATED)
        }
    }

    private companion object {
        const val AUTHORIZATION = "Authorization"
        const val BEARER = "Bearer "
        const val UNAUTHENTICATED = "Unauthenticated"
        const val FORBIDDEN = "Forbidden"
        val SUBSCRIBABLE = setOf("/user/queue/events", "/topic/workspace")
    }
}
