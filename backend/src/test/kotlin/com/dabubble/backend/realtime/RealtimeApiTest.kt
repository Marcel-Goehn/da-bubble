package com.dabubble.backend.realtime

import com.dabubble.backend.conversation.ConversationDto
import com.dabubble.backend.conversation.ConversationKind
import com.dabubble.backend.message.MessageDto
import com.dabubble.backend.message.ReactionDto
import com.dabubble.backend.message.ThreadSummaryDto
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

        (adaTabs + alanTab).forEach { assertEquals(MessageCreatedEvent(sent, null), it.awaitEvent()) }
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

        assertEquals(MessageCreatedEvent(secret, null), alanTab.awaitEvent())
        assertEquals(MessageCreatedEvent(public, null), graceTab.awaitEvent())
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

        assertEquals(MessageCreatedEvent(secret, null), alanTab.awaitEvent())
        assertEquals(MessageCreatedEvent(public, null), graceTab.awaitEvent())
    }

    @Test
    fun `the first Message of a DM brings it into both Users' sidebars live`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        val adaTab = stomp.connect(provision(ada))
        val alanTab = stomp.connect(provision(alan))

        val sent =
            post("/api/direct-messages/$alan/messages", TestTokens.user(ada), """{"text":"Hallo Alan"}""")
                .expectStatus()
                .isCreated
                .expectBody(MessageDto::class.java)
                .returnResult()
                .responseBody!!

        listOf(adaTab to alan, alanTab to ada).forEach { (tab, partner) ->
            assertEquals(MessageCreatedEvent(sent, null), tab.awaitEvent())
            assertEquals(
                ConversationUpsertedEvent(
                    ConversationDto(
                        id = sent.conversationId,
                        kind = ConversationKind.DIRECT_MESSAGE,
                        name = null,
                        description = null,
                        creatorId = null,
                        isDefault = false,
                        partnerId = partner,
                        lastActivityAt = sent.createdAt,
                    ),
                ),
                tab.awaitEvent(),
            )
        }
    }

    @Test
    fun `a new Channel appears live in the sidebar of each of its Members, and nobody else's`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        val adaToken = provision(ada)
        val adaTab = stomp.connect(adaToken)
        val alanTab = stomp.connect(provision(alan))
        val graceTab = stomp.connect(provision())

        val request = """{"name":"Marketing","addDefaultChannelMembers":false,"memberIds":["$alan"]}"""
        val created =
            post("/api/channels", adaToken, request)
                .expectStatus()
                .isCreated
                .expectBody(ConversationDto::class.java)
                .returnResult()
                .responseBody!!
        val public = send(adaToken, "Für alle")

        listOf(adaTab, alanTab).forEach { assertEquals(ConversationUpsertedEvent(created), it.awaitEvent()) }
        assertEquals(MessageCreatedEvent(public, null), graceTab.awaitEvent())
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
        assertEquals(MessageCreatedEvent(sent, null), later.awaitEvent())
    }

    @Test
    fun `a rejected Message pushes nothing`() {
        val token = provision()
        val tab = stomp.connect(token)

        post("/api/conversations/1/messages", token, """{"text":" "}""").expectStatus().isBadRequest
        val sent = send(token, "Danach")

        assertEquals(MessageCreatedEvent(sent, null), tab.awaitEvent())
    }

    @Test
    fun `an edit and a delete reach every tab of the Conversation's Users, with the bumped activity`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        val adaToken = provision(ada)
        provision(alan)
        val dm = directMessage(ada, alan)
        val sent = send(adaToken, "Hallo", dm)
        val tabs = listOf(adaToken, adaToken, TestTokens.user(alan)).map { stomp.connect(it) }

        clock.set(clock.instant() + Duration.ofMinutes(1))
        val edited = editMessage(adaToken, dm, sent.id)
        clock.set(clock.instant() + Duration.ofMinutes(1))
        val deleted = deleteMessage(adaToken, dm, sent.id)

        tabs.forEach { tab ->
            listOf(edited, deleted).forEach { message ->
                assertEquals(MessageUpdatedEvent(message), tab.awaitEvent())
                val upserted = tab.awaitEvent() as ConversationUpsertedEvent
                assertEquals(message.deletedAt ?: message.editedAt, upserted.conversation.lastActivityAt)
            }
        }
    }

    @Test
    fun `a Reply reaches the Conversation's Users with its parent's new reply count and last-reply time`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        val adaToken = provision(ada)
        val alanToken = provision(alan)
        val dm = directMessage(ada, alan)
        val parent = send(adaToken, "Frage", dm)
        send(alanToken, "Erst mal oben", dm)
        val tabs = listOf(adaToken, alanToken).map { stomp.connect(it) }

        clock.set(clock.instant() + Duration.ofMinutes(1))
        val first = reply(alanToken, dm, parent.id, "Erste Antwort")
        clock.set(clock.instant() + Duration.ofMinutes(1))
        val second = reply(adaToken, dm, parent.id, "Zweite Antwort")

        tabs.forEach { tab ->
            listOf(first to 1, second to 2).forEach { (reply, count) ->
                assertEquals(
                    MessageCreatedEvent(reply, ThreadSummaryDto(parent.id, count, reply.createdAt)),
                    tab.awaitEvent(),
                )
                val upserted = tab.awaitEvent() as ConversationUpsertedEvent
                assertEquals(reply.createdAt, upserted.conversation.lastActivityAt)
            }
        }
    }

    @Test
    fun `a rejected edit and a repeated delete push nothing`() {
        val token = provision()
        val sent = send(token, "Hallo")
        deleteMessage(token, 1, sent.id)
        val tab = stomp.connect(token)

        put("/api/conversations/1/messages/${sent.id}", token, """{"text":"Neu"}""").expectStatus().isEqualTo(409)
        deleteMessage(token, 1, sent.id)
        val after = send(token, "Danach")

        assertEquals(MessageCreatedEvent(after, null), tab.awaitEvent())
    }

    @Test
    fun `adding and removing a Reaction reach every tab of the Conversation's Users, with the bumped activity`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        val adaToken = provision(ada)
        val alanToken = provision(alan)
        val dm = directMessage(ada, alan)
        val sent = send(adaToken, "Hallo", dm)
        val tabs = listOf(adaToken, adaToken, alanToken).map { stomp.connect(it) }

        clock.set(clock.instant() + Duration.ofMinutes(1))
        val added = react(alanToken, dm, sent.id, "👍")
        val addedAt = clock.instant().truncatedTo(ChronoUnit.MICROS)
        clock.set(clock.instant() + Duration.ofMinutes(1))
        val removed = react(alanToken, dm, sent.id, "👍")
        val removedAt = clock.instant().truncatedTo(ChronoUnit.MICROS)

        assertEquals(listOf(ReactionDto("👍", listOf(alan))), added.reactions)
        assertEquals(emptyList<ReactionDto>(), removed.reactions)
        tabs.forEach { tab ->
            listOf(added to addedAt, removed to removedAt).forEach { (message, at) ->
                assertEquals(MessageUpdatedEvent(message), tab.awaitEvent())
                val upserted = tab.awaitEvent() as ConversationUpsertedEvent
                assertEquals(at, upserted.conversation.lastActivityAt)
            }
        }
    }

    @Test
    fun `a rejected Reaction pushes nothing`() {
        val token = provision()
        val sent = send(token, "Hallo")
        val tab = stomp.connect(token)

        post("/api/conversations/1/messages/${sent.id}/reactions", token, """{"emoji":"a"}""")
            .expectStatus()
            .isBadRequest
        val after = send(token, "Danach")

        assertEquals(MessageCreatedEvent(after, null), tab.awaitEvent())
    }

    private fun react(
        token: String,
        conversationId: Long,
        messageId: Long,
        emoji: String,
    ): MessageDto =
        post("/api/conversations/$conversationId/messages/$messageId/reactions", token, """{"emoji":"$emoji"}""")
            .expectStatus()
            .isOk
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun reply(
        token: String,
        conversationId: Long,
        parentId: Long,
        text: String,
    ): MessageDto =
        post("/api/conversations/$conversationId/messages/$parentId/replies", token, """{"text":"$text"}""")
            .expectStatus()
            .isCreated
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun editMessage(
        token: String,
        conversationId: Long,
        messageId: Long,
    ): MessageDto =
        put("/api/conversations/$conversationId/messages/$messageId", token, """{"text":"Bearbeitet"}""")
            .expectStatus()
            .isOk
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun deleteMessage(
        token: String,
        conversationId: Long,
        messageId: Long,
    ): MessageDto =
        delete("/api/conversations/$conversationId/messages/$messageId", token)
            .expectStatus()
            .isOk
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!

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
