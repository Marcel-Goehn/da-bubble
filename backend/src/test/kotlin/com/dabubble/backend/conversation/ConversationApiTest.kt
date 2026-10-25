package com.dabubble.backend.conversation

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.MutableClock
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.test.json.JsonCompareMode
import java.time.Duration
import java.util.UUID

class ConversationApiTest : IntegrationTest() {
    @Test
    fun `a new User's sidebar holds the Default Channel and their self-DM`() {
        val sub = UUID.randomUUID()

        get("/api/conversations", TestTokens.user(sub))
            .expectStatus()
            .isOk
            .expectBody()
            .json(
                """
                [
                  {"id":1,"kind":"CHANNEL","name":"Allgemein","description":null,"creatorId":null,"isDefault":true,"partnerId":null,"lastActivityAt":"2026-01-15T09:30:00.123456Z","members":[{"userId":"$sub","isAdmin":false,"joinedAt":"2026-01-15T09:30:00.123456Z"}]},
                  {"id":2,"kind":"DIRECT_MESSAGE","name":null,"description":null,"creatorId":null,"isDefault":false,"partnerId":"$sub","lastActivityAt":"2026-01-15T09:30:00.123456Z","members":[]}
                ]
                """.trimIndent(),
                JsonCompareMode.STRICT,
            )
    }

    @Test
    fun `the sidebar lists only the Channels the User is a Member of and their own DMs`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        val grace = UUID.randomUUID()
        listOf(ada, alan, grace).forEach { get("/api/me", TestTokens.user(it)).expectStatus().isOk }
        val adasChannel = channel("Entwicklerteam", members = listOf(ada, alan))
        channel("Marketing", members = listOf(alan))
        val adaAndAlan = directMessage(ada, alan)
        directMessage(alan, grace)

        val listed = listedIds(TestTokens.user(ada))

        assertEquals(setOf(defaultChannelId(), selfDmId(ada), adasChannel, adaAndAlan), listed)
    }

    @Test
    fun `a DM opens with the other User as partner`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        listOf(ada, alan).forEach { get("/api/me", TestTokens.user(it)).expectStatus().isOk }
        val dm = directMessage(ada, alan)

        get("/api/conversations/$dm", TestTokens.user(ada))
            .expectStatus()
            .isOk
            .expectBody()
            .json(
                """
                {
                  "id":$dm,"kind":"DIRECT_MESSAGE","name":null,"description":null,"creatorId":null,"isDefault":false,"partnerId":"$alan",
                  "lastActivityAt":"2026-01-15T09:30:00.123456Z","members":[]
                }
                """.trimIndent(),
                JsonCompareMode.STRICT,
            )
    }

    @Test
    fun `a Conversation the User can't see is not found`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        val grace = UUID.randomUUID()
        listOf(ada, alan, grace).forEach { get("/api/me", TestTokens.user(it)).expectStatus().isOk }
        val hidden =
            listOf(channel("Marketing", members = listOf(alan)), directMessage(alan, grace), selfDmId(alan), 999L)

        hidden.forEach { id ->
            get("/api/conversations/$id", TestTokens.user(ada))
                .expectStatus()
                .isNotFound
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("NOT_FOUND")
        }
    }

    @Test
    fun `a new Message bumps its Conversation's last activity`() {
        val ada = UUID.randomUUID()
        val alan = UUID.randomUUID()
        listOf(ada, alan).forEach { get("/api/me", TestTokens.user(it)).expectStatus().isOk }
        val dm = directMessage(ada, alan)
        val later = MutableClock.START + Duration.ofMinutes(5)
        clock.set(later)

        post("/api/conversations/$dm/messages", TestTokens.user(alan), """{"text":"Hallo"}""").expectStatus().isCreated

        get("/api/conversations/$dm", TestTokens.user(ada))
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.lastActivityAt")
            .isEqualTo("2026-01-15T09:35:00.123456Z")
    }

    private fun listedIds(token: String): Set<Long> =
        get("/api/conversations", token)
            .expectStatus()
            .isOk
            .expectBody(Array<ConversationDto>::class.java)
            .returnResult()
            .responseBody!!
            .map { it.id }
            .toSet()

    private fun defaultChannelId(): Long =
        jdbc
            .sql("SELECT id FROM conversations WHERE is_default")
            .query(Long::class.java)
            .single()

    private fun selfDmId(user: UUID): Long =
        jdbc
            .sql("SELECT id FROM conversations WHERE user_low = :user AND user_high = :user")
            .param("user", user)
            .query(Long::class.java)
            .single()
}
