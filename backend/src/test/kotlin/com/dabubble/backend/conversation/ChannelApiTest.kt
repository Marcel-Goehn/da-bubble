package com.dabubble.backend.conversation

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Test
import org.springframework.test.json.JsonCompareMode
import org.springframework.test.web.servlet.client.RestTestClient
import tools.jackson.databind.json.JsonMapper
import java.util.UUID

class ChannelApiTest : IntegrationTest() {
    private val json = JsonMapper.builder().build()

    @Test
    fun `a User creates a Channel with a trimmed name and a description, and is its Creator`() {
        val ada = provision()

        create(ada, "  Entwicklerteam ", description = "Alles rund ums Entwickeln")
            .expectStatus()
            .isCreated
            .expectBody()
            .json(
                """
                {
                  "id":3,"kind":"CHANNEL","name":"Entwicklerteam","description":"Alles rund ums Entwickeln",
                  "creatorId":"$ada","isDefault":false,"partnerId":null,
                  "lastActivityAt":"2026-01-15T09:30:00.123456Z"
                }
                """.trimIndent(),
                JsonCompareMode.STRICT,
            )
    }

    @Test
    fun `a name already taken, ignoring case and surrounding spaces, is refused`() {
        val ada = provision()
        val alan = provision()
        // Taken in a Channel Ada can't see.
        channel("Entwicklerteam", members = listOf(alan))

        listOf("Entwicklerteam", "entwicklerTEAM", " ENTWICKLERTEAM  ").forEach {
            create(ada, it)
                .expectStatus()
                .isEqualTo(409)
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("CHANNEL_NAME_TAKEN")
        }
    }

    @Test
    fun `the Default Channel's names are reserved in both languages`() {
        val ada = provision()

        listOf("Allgemein", "allgemein", "General", " GENERAL ").forEach {
            create(ada, it)
                .expectStatus()
                .isEqualTo(409)
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("CHANNEL_NAME_TAKEN")
        }
    }

    @Test
    fun `a blank name is refused`() {
        val ada = provision()

        listOf("", "   ").forEach {
            create(ada, it)
                .expectStatus()
                .isBadRequest
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("CHANNEL_NAME_EMPTY")
        }
    }

    @Test
    fun `a name of up to 50 characters is allowed, a longer one refused`() {
        val ada = provision()

        create(ada, "x".repeat(50)).expectStatus().isCreated
        create(ada, "y".repeat(51))
            .expectStatus()
            .isBadRequest
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("CHANNEL_NAME_TOO_LONG")
    }

    @Test
    fun `a blank description is stored as none`() {
        val ada = provision()

        create(ada, "Marketing", description = "  ")
            .expectStatus()
            .isCreated
            .expectBody()
            .jsonPath("$.description")
            .isEmpty
    }

    @Test
    fun `the picked Users become Members, and nobody else`() {
        val ada = provision()
        val alan = provision()
        val grace = provision()
        val linus = provision()

        // Ada picking herself or someone twice changes nothing.
        val id = createdId(create(ada, "Marketing", memberIds = listOf(alan, grace, alan, ada)))

        listOf(ada, alan, grace).forEach { canSee(it, id) }
        get("/api/conversations/$id", TestTokens.user(linus)).expectStatus().isNotFound
    }

    @Test
    fun `everyone in the Default Channel at that moment becomes a Member`() {
        val ada = provision()
        val alan = provision()
        val grace = provision()

        val id = createdId(create(ada, "Marketing", addDefaultChannelMembers = true))
        val linus = provision()

        listOf(ada, alan, grace).forEach { canSee(it, id) }
        get("/api/conversations/$id", TestTokens.user(linus)).expectStatus().isNotFound
    }

    @Test
    fun `picking an unknown User creates nothing`() {
        val ada = provision()

        create(ada, "Marketing", memberIds = listOf(UUID.randomUUID()))
            .expectStatus()
            .isNotFound
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("NOT_FOUND")
        create(ada, "Marketing").expectStatus().isCreated
    }

    private fun canSee(
        user: UUID,
        channelId: Long,
    ) {
        get("/api/conversations/$channelId", TestTokens.user(user)).expectStatus().isOk
    }

    private fun createdId(response: RestTestClient.ResponseSpec): Long =
        response
            .expectStatus()
            .isCreated
            .expectBody(ConversationDto::class.java)
            .returnResult()
            .responseBody!!
            .id

    private fun create(
        creator: UUID,
        name: String,
        description: String? = null,
        addDefaultChannelMembers: Boolean = false,
        memberIds: List<UUID> = emptyList(),
    ) = post(
        "/api/channels",
        TestTokens.user(creator),
        json.writeValueAsString(
            mapOf(
                "name" to name,
                "description" to description,
                "addDefaultChannelMembers" to addDefaultChannelMembers,
                "memberIds" to memberIds,
            ),
        ),
    )

    private fun provision(sub: UUID = UUID.randomUUID()): UUID {
        get("/api/me", TestTokens.user(sub)).expectStatus().isOk
        return sub
    }
}
