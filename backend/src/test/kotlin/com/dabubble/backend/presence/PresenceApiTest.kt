package com.dabubble.backend.presence

import com.dabubble.backend.realtime.PresenceChangedEvent
import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.StompTestSession
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Duration
import java.util.UUID

class PresenceApiTest : IntegrationTest() {
    @Test
    fun `a User's first tab puts them online for everyone at once, and only Users with a tab are online`() {
        val observer = stomp.connect(provision(UUID.randomUUID()))
        val ada = UUID.randomUUID()
        val adaToken = provision(ada)
        val alan = UUID.randomUUID()
        provision(alan)

        stomp.connect(adaToken)

        assertEquals(PresenceChangedEvent(ada, online = true), observer.awaitPresenceOf(ada))
        val online = online(adaToken)
        assertTrue(ada in online)
        assertFalse(alan in online)
    }

    @Test
    fun `a User goes offline 15 s after their last tab closes, and counts as online until then`() {
        val observerToken = provision(UUID.randomUUID())
        val observer = stomp.connect(observerToken)
        val ada = UUID.randomUUID()
        val tab = stomp.connect(provision(ada))
        observer.awaitPresenceOf(ada)
        val graceEnd = clock.instant() + GRACE

        tab.disconnect()
        scheduler.awaitTaskAt(graceEnd)
        scheduler.runDue(graceEnd - Duration.ofSeconds(1))

        assertTrue(ada in online(observerToken))
        scheduler.runDue(graceEnd)
        assertEquals(PresenceChangedEvent(ada, online = false), observer.awaitPresenceOf(ada))
        assertFalse(ada in online(observerToken))
    }

    @Test
    fun `a User who reconnects inside the 15 s neither goes offline nor comes online again`() {
        val observerToken = provision(UUID.randomUUID())
        val observer = stomp.connect(observerToken)
        val ada = UUID.randomUUID()
        val adaToken = provision(ada)
        val tab = stomp.connect(adaToken)
        observer.awaitPresenceOf(ada)
        val graceEnd = clock.instant() + GRACE

        tab.disconnect()
        scheduler.awaitTaskAt(graceEnd)
        stomp.connect(adaToken)
        scheduler.runDue(graceEnd)

        // Someone else coming online after it all shows nothing about Ada was sent in between.
        val grace = UUID.randomUUID()
        stomp.connect(provision(grace))
        assertEquals(PresenceChangedEvent(grace, online = true), observer.awaitPresenceOf(ada, grace))
        assertTrue(ada in online(observerToken))
    }

    @Test
    fun `a User stays online while any of their tabs is open`() {
        val observerToken = provision(UUID.randomUUID())
        val observer = stomp.connect(observerToken)
        val ada = UUID.randomUUID()
        val adaToken = provision(ada)
        val first = stomp.connect(adaToken)
        observer.awaitPresenceOf(ada)
        val second = stomp.connect(adaToken)
        val graceEnd = clock.instant() + GRACE

        first.disconnect()
        scheduler.runDue(graceEnd)

        // Someone else coming online then shows nothing about Ada was sent while the second tab was open.
        val grace = UUID.randomUUID()
        stomp.connect(provision(grace))
        assertEquals(PresenceChangedEvent(grace, online = true), observer.awaitPresenceOf(ada, grace))
        assertTrue(ada in online(observerToken))
        second.disconnect()
        scheduler.awaitTaskAt(graceEnd)
        scheduler.runDue(graceEnd)
        assertEquals(PresenceChangedEvent(ada, online = false), observer.awaitPresenceOf(ada))
    }

    private fun provision(sub: UUID): String {
        val token = TestTokens.user(sub)
        get("/api/me", token).expectStatus().isOk
        return token
    }

    private fun online(token: String): List<UUID> =
        get("/api/presence", token)
            .expectStatus()
            .isOk
            .expectBody(Array<UUID>::class.java)
            .returnResult()
            .responseBody!!
            .toList()

    // Users of earlier tests may still be going offline, so their events are skipped.
    private fun StompTestSession.awaitPresenceOf(vararg users: UUID): PresenceChangedEvent =
        generateSequence { awaitWorkspaceEvent() }
            .filterIsInstance<PresenceChangedEvent>()
            .first { it.userId in users }

    private companion object {
        val GRACE: Duration = Duration.ofSeconds(15)
    }
}
