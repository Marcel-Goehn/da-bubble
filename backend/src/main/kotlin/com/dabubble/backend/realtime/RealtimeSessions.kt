package com.dabubble.backend.realtime

import com.dabubble.backend.time.ScheduledTask
import com.dabubble.backend.time.Scheduler
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.WebSocketHandlerDecorator
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/**
 * The open WebSocket sessions, so one can be closed when its token expires: the client then reconnects with
 * a fresh token, and a session never outlives the token that authenticated it.
 */
@Component
class RealtimeSessions(
    private val scheduler: Scheduler,
) : WebSocketHandlerDecoratorFactory {
    private class OpenSession(
        val session: WebSocketSession,
        @Volatile var expiry: ScheduledTask? = null,
    )

    private val open = ConcurrentHashMap<String, OpenSession>()

    override fun decorate(handler: WebSocketHandler): WebSocketHandler =
        object : WebSocketHandlerDecorator(handler) {
            override fun afterConnectionEstablished(session: WebSocketSession) {
                open[session.id] = OpenSession(session)
                super.afterConnectionEstablished(session)
            }

            override fun afterConnectionClosed(
                session: WebSocketSession,
                closeStatus: CloseStatus,
            ) {
                open.remove(session.id)?.expiry?.cancel()
                super.afterConnectionClosed(session, closeStatus)
            }
        }

    /** Closes the session [sessionId] (the STOMP `simpSessionId`) at [instant]. */
    fun closeAt(
        sessionId: String,
        instant: Instant,
    ) {
        val open = open[sessionId] ?: return
        open.expiry = scheduler.schedule(instant) { open.session.close(TOKEN_EXPIRED) }
    }

    private companion object {
        val TOKEN_EXPIRED: CloseStatus = CloseStatus.NORMAL.withReason("Token expired")
    }
}
