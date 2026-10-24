package com.dabubble.backend.time

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.TaskScheduler
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler
import java.time.Clock
import java.time.Instant
import java.time.temporal.ChronoUnit

@Configuration
class TimeConfig {
    @Bean
    fun clock(): Clock = Clock.systemUTC()

    @Bean
    fun taskScheduler(): ThreadPoolTaskScheduler = ThreadPoolTaskScheduler().apply { setThreadNamePrefix("scheduler-") }

    @Bean
    fun scheduler(taskScheduler: TaskScheduler): Scheduler =
        Scheduler { instant, task ->
            val future = taskScheduler.schedule(task, instant)
            ScheduledTask { future.cancel(false) }
        }
}

/** The current time as stored: Postgres `timestamptz` keeps microseconds, so anything finer would not round-trip. */
fun Clock.now(): Instant = Instant.now(this).truncatedTo(ChronoUnit.MICROS)
