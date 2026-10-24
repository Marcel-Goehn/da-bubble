package com.dabubble.backend.message

import com.dabubble.backend.conversation.ConversationDto
import com.dabubble.backend.conversation.ConversationKind
import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class DirectMessageApiTest : IntegrationTest() {
    @Test
    fun `the first Message to a User creates the DM, which both then list and read`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        provision(ada)
        provision(alan)
        assertEquals(emptyList<ConversationDto>(), dms(ada).filter { it.partnerId == alan })

        val sent = sendTo(ada, alan, "Hallo Alan")

        val adasDm = dms(ada).single { it.partnerId == alan }
        val alansDm = dms(alan).single { it.partnerId == ada }
        assertEquals(sent.conversationId, adasDm.id)
        assertEquals(sent.conversationId, alansDm.id)
        assertEquals(listOf("Hallo Alan"), texts(alan, sent.conversationId))
    }

    @Test
    fun `first Messages sent at the same time from both sides share one DM`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        provision(ada)
        provision(alan)
        val start = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(RACERS)

        val sent =
            try {
                (1..RACERS)
                    .map { i ->
                        val (from, to) = if (i % 2 == 0) ada to alan else alan to ada
                        pool.submit<MessageDto> {
                            start.await()
                            sendTo(from, to, "Nachricht $i")
                        }
                    }.also { start.countDown() }
                    .map { it.get(TIMEOUT_SECONDS, TimeUnit.SECONDS) }
            } finally {
                pool.shutdownNow()
            }

        assertEquals(1, sent.map { it.conversationId }.toSet().size)
        assertEquals(listOf(sent.first().conversationId), dms(ada).filter { it.partnerId == alan }.map { it.id })
    }

    @Test
    fun `a Message to oneself goes to the self-DM`() {
        val ada = UUID.randomUUID()
        provision(ada)
        val selfDm = dms(ada).single()

        val sent = sendTo(ada, ada, "Notiz an mich")

        assertEquals(selfDm.id, sent.conversationId)
        assertEquals(listOf(selfDm.id), dms(ada).map { it.id })
    }

    @Test
    fun `only the two Users see a DM`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        val grace = UUID.randomUUID()
        listOf(ada, alan, grace).forEach(::provision)

        val dm = sendTo(ada, alan, "Nur für dich").conversationId

        assertEquals(listOf(grace), dms(grace).map { it.partnerId })
        get("/api/conversations/$dm", TestTokens.user(grace)).expectStatus().isNotFound
        get("/api/conversations/$dm/messages", TestTokens.user(grace)).expectStatus().isNotFound
    }

    @Test
    fun `a Message to an unknown User is not found and creates nothing`() {
        val ada = UUID.randomUUID()
        provision(ada)

        post("/api/direct-messages/${UUID.randomUUID()}/messages", TestTokens.user(ada), """{"text":"Hallo?"}""")
            .expectStatus()
            .isNotFound
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("NOT_FOUND")
        assertEquals(listOf(ada), dms(ada).map { it.partnerId })
    }

    @Test
    fun `a blank first Message creates no DM`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        provision(ada)
        provision(alan)

        post("/api/direct-messages/$alan/messages", TestTokens.user(ada), """{"text":" "}""")
            .expectStatus()
            .isBadRequest
        assertEquals(listOf(ada), dms(ada).map { it.partnerId })
    }

    private fun provision(sub: UUID) {
        get("/api/me", TestTokens.user(sub)).expectStatus().isOk
    }

    private fun sendTo(
        author: UUID,
        partner: UUID,
        text: String,
    ): MessageDto =
        post("/api/direct-messages/$partner/messages", TestTokens.user(author), """{"text":"$text"}""")
            .expectStatus()
            .isCreated
            .expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!

    private fun dms(user: UUID): List<ConversationDto> =
        get("/api/conversations", TestTokens.user(user))
            .expectStatus()
            .isOk
            .expectBody(Array<ConversationDto>::class.java)
            .returnResult()
            .responseBody!!
            .filter { it.kind == ConversationKind.DIRECT_MESSAGE }

    private fun texts(
        user: UUID,
        conversationId: Long,
    ): List<String> =
        get("/api/conversations/$conversationId/messages", TestTokens.user(user))
            .expectStatus()
            .isOk
            .expectBody(MessagePageDto::class.java)
            .returnResult()
            .responseBody!!
            .messages
            .map { it.text }

    private companion object {
        const val RACERS = 8
        const val TIMEOUT_SECONDS = 10L
    }
}
