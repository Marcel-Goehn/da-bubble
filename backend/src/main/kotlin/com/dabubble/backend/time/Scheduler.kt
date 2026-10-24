package com.dabubble.backend.time

import java.time.Instant

/** Runs tasks at a given instant. A seam: tests run the due tasks themselves instead of waiting for them. */
fun interface Scheduler {
    /** Runs [task] at [instant], or at once if that has passed; the returned handle cancels it. */
    fun schedule(
        instant: Instant,
        task: Runnable,
    ): ScheduledTask
}

fun interface ScheduledTask {
    fun cancel()
}
