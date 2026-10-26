package com.dabubble.backend.attachment

import com.dabubble.backend.storage.FileDeletions
import com.dabubble.backend.time.Scheduler
import com.dabubble.backend.time.now
import org.slf4j.LoggerFactory
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration

/** Every [INTERVAL], retries the files storage failed to delete, then sweeps unused Pending Uploads. */
@Component
class FileCleanup(
    private val files: FileDeletions,
    private val pendingUploads: PendingUploads,
    private val scheduler: Scheduler,
    private val clock: Clock,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /** Schedules the first cleanup; each one schedules the next. */
    @EventListener(ApplicationReadyEvent::class)
    fun start() {
        scheduler.schedule(clock.now() + INTERVAL, ::run)
    }

    // A failed cleanup is tried again at the next one.
    @Suppress("TooGenericExceptionCaught")
    private fun run() {
        try {
            files.retry()
            pendingUploads.sweep()
        } catch (e: Exception) {
            log.warn("File cleanup failed", e)
        } finally {
            start()
        }
    }

    companion object {
        val INTERVAL: Duration = Duration.ofHours(1)
    }
}
