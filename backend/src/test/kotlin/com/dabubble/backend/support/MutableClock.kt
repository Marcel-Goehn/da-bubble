package com.dabubble.backend.support

import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/** A [Clock] tests move by hand. Starts with nanoseconds so microsecond truncation is observable. */
class MutableClock(
    @Volatile private var instant: Instant = START,
) : Clock() {
    override fun getZone(): ZoneId = ZoneOffset.UTC

    override fun withZone(zone: ZoneId): Clock = throw UnsupportedOperationException("The app clock is always UTC")

    override fun instant(): Instant = instant

    fun set(instant: Instant) {
        this.instant = instant
    }

    fun reset() = set(START)

    companion object {
        val START: Instant = Instant.parse("2026-01-15T09:30:00.123456789Z")
    }
}
