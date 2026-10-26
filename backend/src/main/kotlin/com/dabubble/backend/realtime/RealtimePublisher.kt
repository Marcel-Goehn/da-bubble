package com.dabubble.backend.realtime

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.UUID

/** Pushes [RealtimeEvent]s to the Users they concern: those caused by a write only once it has committed. */
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
        afterCommit { recipients.forEach { messaging.convertAndSendToUser(it.toString(), USER_EVENTS, event) } }
    }

    /** Sends [event] to every open tab of the Workspace after the current transaction commits. */
    fun toWorkspaceAfterCommit(event: RealtimeEvent) {
        afterCommit { messaging.convertAndSend(WORKSPACE, event) }
    }

    /** Sends [event] to every open tab of the Workspace now; for events no write causes, such as Presence. */
    fun toWorkspace(event: RealtimeEvent) {
        messaging.convertAndSend(WORKSPACE, event)
    }

    private fun afterCommit(send: () -> Unit) {
        check(TransactionSynchronizationManager.isSynchronizationActive()) { "Events are sent after a commit" }
        TransactionSynchronizationManager.registerSynchronization(
            object : TransactionSynchronization {
                override fun afterCommit() = send()
            },
        )
    }

    private companion object {
        const val WORKSPACE = "/topic/workspace"

        // Clients subscribe to `/user/queue/events`; the user destination prefix is added when resolving.
        const val USER_EVENTS = "/queue/events"
    }
}
