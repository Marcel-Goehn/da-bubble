package com.dabubble.backend.realtime

import com.dabubble.backend.message.MessageDto
import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

class RealtimeApiTest : IntegrationTest() {
    @Test
    fun `every tab of the Conversation's Users gets a sent Message, the sender's included`() {
        val ada = provision()
        val alan = provision()
        val adaTabs = listOf(stomp.connect(ada), stomp.connect(ada))
        val alanTab = stomp.connect(alan)

        val sent = send(ada, "Hallo zusammen")

        (adaTabs + alanTab).forEach { assertEquals(MessageCreatedEvent(sent), it.awaitEvent()) }
    }

    @Test
    fun `a User outside the Channel gets nothing of it`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        val adaToken = provision(ada)
        val alanTab = stomp.connect(provision(alan))
        val graceTab = stomp.connect(provision())
        val marketing = channel("Marketing", members = listOf(ada, alan))

        val secret = send(adaToken, "Nur Marketing", marketing)
        // A Message everyone sees, so the absence of the first is observed without waiting for nothing.
        val public = send(adaToken, "Für alle")

        assertEquals(MessageCreatedEvent(secret), alanTab.awaitEvent())
        assertEquals(MessageCreatedEvent(public), graceTab.awaitEvent())
    }

    @Test
    fun `a DM's two Users get its Messages, and nobody else does`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        val adaToken = provision(ada)
        val alanTab = stomp.connect(provision(alan))
        val graceTab = stomp.connect(provision())
        val dm = directMessage(ada, alan)

        val secret = send(adaToken, "Nur für dich", dm)
        val public = send(adaToken, "Für alle")

        assertEquals(MessageCreatedEvent(secret), alanTab.awaitEvent())
        assertEquals(MessageCreatedEvent(public), graceTab.awaitEvent())
    }

    @Test
    fun `a CONNECT without a valid token is refused`() {
        listOf("kaputt", TestTokens.user(emailVerified = false), TestTokens.user(audience = "someone-else")).forEach {
            assertEquals("Unauthenticated", stomp.connectRefused(it))
        }
    }

    @Test
    fun `a client may only subscribe to its own events and the Workspace's`() {
        val tab = stomp.connect(provision())

        assertEquals("Forbidden", tab.subscribeRefused("/queue/events-user-of-someone-else"))
    }

    @Test
    fun `the server closes a session when its token expires`() {
        val sub = UUID.randomUUID()
        val token = provision(sub)
        // A token's exp has whole seconds.
        val expiry = (Instant.now() + Duration.ofMinutes(5)).truncatedTo(ChronoUnit.SECONDS)
        val expiring = stomp.connect(TestTokens.user(sub, expiresAt = expiry))
        val later = stomp.connect(TestTokens.user(sub, expiresAt = expiry + Duration.ofMinutes(1)))

        scheduler.runDue(expiry)

        expiring.awaitClosed()
        val sent = send(token, "Noch da?")
        assertEquals(MessageCreatedEvent(sent), later.awaitEvent())
    }

    @Test
    fun `a rejected Message pushes nothing`() {
        val token = provision()
        val tab = stomp.connect(token)

        post("/api/conversations/1/messages", token, """{"text":" "}""").expectStatus().isBadRequest
        val sent = send(token, "Danach")

        assertEquals(MessageCreatedEvent(sent), tab.awaitEvent())
    }

    private fun provision(sub: UUID = UUID.randomUUID()): String {
        val token = TestTokens.user(sub)
        get("/api/me", token).expectStatus().isOk
        return token
    }

    private fun send(
        token: String,
        text: String,
        conversationId: Long = 1,
    ): MessageDto =
        post("/api/conversations/$conversationId/messages", token, """{"text":"$text"}""")
            .expectStatus()
            .isCreated
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!
}
