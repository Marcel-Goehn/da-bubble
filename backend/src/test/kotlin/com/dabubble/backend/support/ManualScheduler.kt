package com.dabubble.backend.support

import com.dabubble.backend.time.ScheduledTask
import com.dabubble.backend.time.Scheduler
import java.time.Instant

/** A [Scheduler] whose tasks run only when a test calls [runDue], so nothing waits for real time. */
class ManualScheduler : Scheduler {
    private class Pending(
        val instant: Instant,
        val task: Runnable,
    )

    private val pending = mutableListOf<Pending>()

    @Synchronized
    override fun schedule(
        instant: Instant,
        task: Runnable,
    ): ScheduledTask {
        val scheduled = Pending(instant, task)
        pending += scheduled
        return ScheduledTask { synchronized(this) { pending -= scheduled } }
    }

    /** Runs, in order, every task due at or before [instant]. */
    fun runDue(instant: Instant) {
        val due =
            synchronized(this) {
                pending.filter { !it.instant.isAfter(instant) }.sortedBy { it.instant }.also { pending -= it }
            }
        due.forEach { it.task.run() }
    }

    @Synchronized
    fun reset() = pending.clear()
}
