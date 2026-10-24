package com.dabubble.backend.presence

import com.dabubble.backend.realtime.PresenceChangedEvent
import com.dabubble.backend.realtime.RealtimePublisher
import com.dabubble.backend.realtime.StompUser
import com.dabubble.backend.time.ScheduledTask
import com.dabubble.backend.time.Scheduler
import org.springframework.context.event.EventListener
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.messaging.simp.SimpMessageHeaderAccessor
import org.springframework.stereotype.Service
import org.springframework.web.socket.messaging.SessionConnectedEvent
import org.springframework.web.socket.messaging.SessionDisconnectEvent
import java.time.Clock
import java.time.Duration
import java.util.UUID

/**
 * Who is online, from the open STOMP sessions of each User; held in memory only, as there's one instance.
 * A User goes online with their first session and offline [GRACE] after their last one closes, unless one
 * opens meanwhile: a reload, a reconnect at token expiry or a short network drop doesn't make them flicker.
 * A missed heartbeat closes the session, so it counts as a disconnect.
 */
@Service
class PresenceService(
    private val publisher: RealtimePublisher,
    private val scheduler: Scheduler,
    private val clock: Clock,
) {
    /** A User's open sessions, and their offline broadcast while it's pending. */
    private class UserSessions {
        val open = mutableSetOf<String>()
        var goingOffline: ScheduledTask? = null
    }

    private val online = mutableMapOf<UUID, UserSessions>()

    /** The Users online right now, those inside their grace window included. */
    @Synchronized
    fun online(): Set<UUID> = online.keys.toSet()

    // Connected, not Connect: only once the CONNECT frame is authenticated does the session have its User.
    @EventListener
    @Synchronized
    fun onConnected(event: SessionConnectedEvent) {
        val user = event.user as? StompUser ?: return
        val state = online.getOrPut(user.id) { UserSessions() }
        if (state.open.isEmpty() && state.goingOffline == null) {
            publisher.toWorkspace(PresenceChangedEvent(user.id, online = true))
        }
        state.goingOffline?.cancel()
        state.goingOffline = null
        state.open += sessionId(event)
    }

    // Spring may report a session's end more than once; only the removal of a session that was open counts.
    // Ahead of the user registry, so a session gone from there is gone from Presence too.
    @EventListener
    @Order(Ordered.HIGHEST_PRECEDENCE)
    @Synchronized
    fun onDisconnect(event: SessionDisconnectEvent) {
        val user = event.user as? StompUser ?: return
        val state = online[user.id]
        if (state == null || !state.open.remove(event.sessionId) || state.open.isNotEmpty()) {
            return
        }
        lateinit var task: ScheduledTask
        task = scheduler.schedule(clock.instant() + GRACE) { goOffline(user.id, task) }
        state.goingOffline = task
    }

    // A cancelled task may already be running; it then finds itself replaced and does nothing.
    @Synchronized
    private fun goOffline(
        userId: UUID,
        task: ScheduledTask,
    ) {
        if (online[userId]?.goingOffline !== task) {
            return
        }
        online -= userId
        publisher.toWorkspace(PresenceChangedEvent(userId, online = false))
    }

    private fun sessionId(event: SessionConnectedEvent): String =
        checkNotNull(SimpMessageHeaderAccessor.getSessionId(event.message.headers))

    private companion object {
        val GRACE: Duration = Duration.ofSeconds(15)
    }
}
