package com.dabubble.backend.read

import com.dabubble.backend.conversation.ConversationDto
import com.dabubble.backend.message.MessageDto
import com.dabubble.backend.realtime.MessageCreatedEvent
import com.dabubble.backend.realtime.ReadUpdatedEvent
import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.temporal.ChronoUnit
import java.util.UUID

class UnreadApiTest : IntegrationTest() {
    @Test
    fun `Messages and Replies from others count as Unread in their Conversation`() {
        val ada = provision()
        val alan = provision()
        later()
        val parent = send(alan, "Hallo")
        send(alan, "Noch da?")
        reply(alan, parent.id, "Im Thread")

        assertEquals(
            UnreadDto(listOf(ConversationUnreadDto(1, 3)), listOf(ThreadUnreadDto(1, parent.id, 1))),
            unread(ada),
        )
    }

    @Test
    fun `opening a Conversation clears its count but not N neu, and what arrives later counts again`() {
        val ada = provision()
        val alan = provision()
        later()
        val parent = send(alan, "Hallo")
        reply(alan, parent.id, "Im Thread")
        later()

        markRead(ada, 1).expectStatus().isNoContent
        assertEquals(UnreadDto(emptyList(), listOf(ThreadUnreadDto(1, parent.id, 1))), unread(ada))

        later()
        send(alan, "Danach")
        assertEquals(listOf(ConversationUnreadDto(1, 1)), unread(ada).conversations)
    }

    @Test
    fun `opening a Thread clears its N neu only, and later Replies count again`() {
        val ada = provision()
        val alan = provision()
        later()
        val parent = send(alan, "Hallo")
        reply(alan, parent.id, "Erste")
        later()

        markThreadRead(ada, 1, parent.id).expectStatus().isNoContent
        assertEquals(UnreadDto(listOf(ConversationUnreadDto(1, 2)), emptyList()), unread(ada))

        later()
        reply(alan, parent.id, "Zweite")
        assertEquals(listOf(ThreadUnreadDto(1, parent.id, 1)), unread(ada).threads)
    }

    @Test
    fun `marking read twice keeps one marker per User and Conversation or Thread, and never moves it back`() {
        val ada = provision()
        val alan = provision()
        later()
        val parent = send(alan, "Hallo")
        reply(alan, parent.id, "Antwort")
        later()
        markRead(ada, 1).expectStatus().isNoContent
        markThreadRead(ada, 1, parent.id).expectStatus().isNoContent
        // A request that took longer and lands later, with an earlier clock.
        clock.set(clock.instant() - Duration.ofMinutes(5))
        markRead(ada, 1).expectStatus().isNoContent
        markThreadRead(ada, 1, parent.id).expectStatus().isNoContent

        assertEquals(1, countRows("conversation_read_markers"))
        assertEquals(1, countRows("thread_read_markers"))
        assertEquals(UnreadDto(emptyList(), emptyList()), unread(ada))
    }

    @Test
    fun `only a Conversation the User sees, and a Thread that is no Reply, can be marked read`() {
        val adaId = UUID.randomUUID()
        val ada = provision(adaId)
        val alan = provision()
        val marketing = channel("Marketing", members = listOf(adaId))
        val secret = send(ada, "Intern", marketing)
        val parent = send(ada, "Frage")
        val answer = reply(ada, parent.id, "Antwort")

        markRead(alan, marketing).expectStatus().isNotFound
        markThreadRead(alan, marketing, secret.id).expectStatus().isNotFound
        markThreadRead(ada, 1, 999).expectStatus().isNotFound
        markThreadRead(ada, 1, answer.id)
            .expectStatus()
            .isBadRequest
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("REPLY_HAS_NO_THREAD")
    }

    @Test
    fun `the User's own Messages and Replies never count`() {
        val ada = provision()
        val alan = provision()
        later()
        val parent = send(alan, "Frage")
        markRead(ada, 1).expectStatus().isNoContent
        later()
        send(ada, "Eigene Nachricht")
        reply(ada, parent.id, "Eigene Antwort")

        assertEquals(UnreadDto(emptyList(), emptyList()), unread(ada))
    }

    @Test
    fun `nothing from before the User joined a Channel counts, in its Threads neither`() {
        val adaId = UUID.randomUUID()
        val alanId = UUID.randomUUID()
        val ada = provision(adaId)
        val alan = provision(alanId)
        val channelId = createChannel(ada, "Marketing")
        later()
        val parent = send(ada, "Vor Alan", channelId)
        reply(ada, parent.id, "Auch vor Alan", channelId)
        later()
        post("/api/channels/$channelId/members", ada, """{"userIds":["$alanId"]}""").expectStatus().isOk
        later()
        send(ada, "Nach Alan", channelId)
        reply(ada, parent.id, "Auch nach Alan", channelId)

        assertEquals(
            UnreadDto(
                listOf(ConversationUnreadDto(channelId, 2)),
                listOf(ThreadUnreadDto(channelId, parent.id, 1)),
            ),
            unread(alan),
        )
    }

    @Test
    fun `a DM counts what the partner sent, and a removed Member counts nothing of the Channel`() {
        val adaId = UUID.randomUUID()
        val alanId = UUID.randomUUID()
        val ada = provision(adaId)
        val alan = provision(alanId)
        val channelId = createChannel(ada, "Marketing", members = listOf(alanId))
        later()
        val dm =
            post("/api/direct-messages/$alanId/messages", ada, """{"text":"Hallo Alan"}""")
                .expectStatus()
                .isCreated
                .expectBody(MessageDto::class.java)
                .returnResult()
                .responseBody!!
                .conversationId
        send(ada, "Im Marketing", channelId)
        delete("/api/channels/$channelId/members/$alanId", ada).expectStatus().isOk

        assertEquals(UnreadDto(listOf(ConversationUnreadDto(dm, 1)), emptyList()), unread(alan))
    }

    @Test
    fun `marking read tells every tab of that User, and nobody else`() {
        val ada = UUID.randomUUID()
        val adaToken = provision(ada)
        val alanToken = provision()
        later()
        val parent = send(alanToken, "Hallo")
        val adaTabs = listOf(stomp.connect(adaToken), stomp.connect(adaToken))
        val alanTab = stomp.connect(alanToken)
        later()

        markRead(adaToken, 1).expectStatus().isNoContent
        markThreadRead(adaToken, 1, parent.id).expectStatus().isNoContent
        val after = send(alanToken, "Danach")

        adaTabs.forEach {
            assertEquals(ReadUpdatedEvent(1, null, clock.instant().truncatedTo(ChronoUnit.MICROS)), it.awaitEvent())
            assertEquals(
                ReadUpdatedEvent(1, parent.id, clock.instant().truncatedTo(ChronoUnit.MICROS)),
                it.awaitEvent(),
            )
        }
        // Alan's first event is the Message he sent after Ada read, so none of hers reached him.
        assertEquals(MessageCreatedEvent(after, null), alanTab.awaitEvent())
    }

    /** Moves the clock on, so what follows is after what came before. */
    private fun later() = clock.set(clock.instant() + Duration.ofMinutes(1))

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

    private fun reply(
        token: String,
        parentId: Long,
        text: String,
        conversationId: Long = 1,
    ): MessageDto =
        post("/api/conversations/$conversationId/messages/$parentId/replies", token, """{"text":"$text"}""")
            .expectStatus()
            .isCreated
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun createChannel(
        token: String,
        name: String,
        members: List<UUID> = emptyList(),
    ): Long =
        post(
            "/api/channels",
            token,
            """{"name":"$name","addDefaultChannelMembers":false,"memberIds":[${members.joinToString { "\"$it\"" }}]}""",
        ).expectStatus()
            .isCreated
            .expectBody(ConversationDto::class.java)
            .returnResult()
            .responseBody!!
            .id

    private fun markRead(
        token: String,
        conversationId: Long,
    ) = put("/api/conversations/$conversationId/read", token, "")

    private fun markThreadRead(
        token: String,
        conversationId: Long,
        parentId: Long,
    ) = put("/api/conversations/$conversationId/messages/$parentId/replies/read", token, "")

    private fun unread(token: String): UnreadDto =
        get("/api/conversations/unread", token)
            .expectStatus()
            .isOk
            .expectBody(UnreadDto::class.java)
            .returnResult()
            .responseBody!!
}
