package com.dabubble.backend.realtime

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.UUID

/** Pushes [RealtimeEvent]s to the Users they concern, only once the write that caused them has committed. */
@Component
class RealtimePublisher(
    private val messaging: SimpMessagingTemplate,
) {
    /**
     * Sends [event] to every open tab of each of [recipients] after the current transaction commits, and not
     * at all if it rolls back. The recipients are resolved by the caller at send time.
     */
    fun toUsers(
        recipients: Collection<UUID>,
        event: RealtimeEvent,
    ) {
        check(TransactionSynchronizationManager.isSynchronizationActive()) { "Events are sent after a commit" }
        TransactionSynchronizationManager.registerSynchronization(
            object : TransactionSynchronization {
                override fun afterCommit() {
                    recipients.forEach { messaging.convertAndSendToUser(it.toString(), USER_EVENTS, event) }
                }
            },
        )
    }

    private companion object {
        // Clients subscribe to `/user/queue/events`; the user destination prefix is added when resolving.
        const val USER_EVENTS = "/queue/events"
    }
}
