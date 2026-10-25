package com.dabubble.backend.conversation

import com.dabubble.backend.support.IntegrationTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Test
import org.springframework.test.json.JsonCompareMode
import org.springframework.test.web.servlet.client.RestTestClient
import tools.jackson.databind.json.JsonMapper
import java.time.Duration
import java.util.UUID

class ChannelAdminApiTest : IntegrationTest() {
    private val json = JsonMapper.builder().build()

    @Test
    fun `a Channel lists its Members, the Creator always an Admin`() {
        val ada = provision()
        val alan = provision()
        val id = create(ada, members = listOf(alan))

        get("/api/conversations/$id", TestTokens.user(alan))
            .expectStatus()
            .isOk
            .expectBody()
            .json(
                """
                {"members":[
                  {"userId":"$ada","isAdmin":true,"joinedAt":"2026-01-15T09:30:00.123456Z"},
                  {"userId":"$alan","isAdmin":false,"joinedAt":"2026-01-15T09:30:00.123456Z"}
                ]}
                """.trimIndent(),
                JsonCompareMode.LENIENT,
            )
    }

    @Test
    fun `the Creator renames a Channel and changes its description`() {
        val ada = provision()
        val id = create(ada)

        edit(ada, id, """{"name":"  Vertrieb ","description":"Alles zum Verkauf"}""")
            .expectStatus()
            .isOk
            .expectBody()
            .json("""{"name":"Vertrieb","description":"Alles zum Verkauf"}""", JsonCompareMode.LENIENT)
        // Only what's given changes; a blank description is none.
        edit(ada, id, """{"description":"  "}""")
            .expectStatus()
            .isOk
            .expectBody()
            .json("""{"name":"Vertrieb","description":null}""", JsonCompareMode.LENIENT)
    }

    @Test
    fun `a new name is refused like a new Channel's`() {
        val ada = provision()
        create(ada, "Vertrieb")
        val id = create(ada)

        mapOf(
            " vertrieb " to "CHANNEL_NAME_TAKEN",
            "General" to "CHANNEL_NAME_TAKEN",
            " " to "CHANNEL_NAME_EMPTY",
            "x".repeat(51) to "CHANNEL_NAME_TOO_LONG",
        ).forEach { (name, code) ->
            edit(ada, id, json.writeValueAsString(mapOf("name" to name)))
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo(code)
        }
        // Its own name in another case is still its own.
        edit(ada, id, """{"name":"MARKETING"}""").expectStatus().isOk
    }

    @Test
    fun `only an Admin edits a Channel, and nobody the Default Channel`() {
        val ada = provision()
        val alan = provision()
        val id = create(ada, members = listOf(alan))

        expectCode(edit(alan, id, """{"name":"Vertrieb"}"""), "NOT_CHANNEL_ADMIN")
        edit(provision(), id, """{"name":"Vertrieb"}""").expectStatus().isNotFound
        expectCode(edit(ada, 1, """{"description":"Für alle"}"""), "NOT_CHANNEL_ADMIN")
    }

    @Test
    fun `an Admin grants Admin to a Member, who may then edit, until it's revoked`() {
        val ada = provision()
        val alan = provision()
        val grace = provision()
        val id = create(ada, members = listOf(alan, grace))

        setAdmin(ada, id, alan, true)
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.members[?(@.userId == '$alan')].isAdmin")
            .isEqualTo(listOf(true))
        // Alan, an Admin now, shares the work.
        setAdmin(alan, id, grace, true).expectStatus().isOk
        edit(alan, id, """{"name":"Vertrieb"}""").expectStatus().isOk
        setAdmin(grace, id, alan, false).expectStatus().isOk

        expectCode(edit(alan, id, """{"name":"Marketing"}"""), "NOT_CHANNEL_ADMIN")
    }

    @Test
    fun `Admin is never granted or revoked by a non-Admin, on the Creator or on yourself`() {
        val ada = provision()
        val alan = provision()
        val grace = provision()
        val id = create(ada, members = listOf(alan, grace))
        setAdmin(ada, id, alan, true).expectStatus().isOk

        expectCode(setAdmin(grace, id, grace, true), "NOT_CHANNEL_ADMIN")
        expectCode(setAdmin(grace, id, alan, false), "NOT_CHANNEL_ADMIN")
        expectCode(setAdmin(alan, id, ada, false), "CHANNEL_CREATOR_PROTECTED")
        expectCode(setAdmin(alan, id, alan, false), "MANAGING_YOURSELF")
        expectCode(setAdmin(ada, id, provision(), true), "NOT_FOUND")
        setAdmin(provision(), id, grace, true).expectStatus().isNotFound
    }

    @Test
    fun `nobody manages the Default Channel's Members`() {
        val ada = provision()
        val alan = provision()

        expectCode(setAdmin(ada, 1, alan, true), "NOT_CHANNEL_ADMIN")
    }

    @Test
    fun `an Admin adds Members, who see the whole history`() {
        val ada = provision()
        val alan = provision()
        val grace = provision()
        val id = create(ada)
        post("/api/conversations/$id/messages", TestTokens.user(ada), """{"text":"Vor eurer Zeit"}""")
            .expectStatus()
            .isCreated
        clock.set(clock.instant() + Duration.ofMinutes(5))

        // Ada again, or someone twice, changes nothing.
        addMembers(ada, id, listOf(alan, grace, alan, ada))
            .expectStatus()
            .isOk
            .expectBody()
            .json(
                """
                {"members":[
                  {"userId":"$ada","joinedAt":"2026-01-15T09:30:00.123456Z"},
                  {"userId":"$alan","isAdmin":false,"joinedAt":"2026-01-15T09:35:00.123456Z"},
                  {"userId":"$grace","isAdmin":false,"joinedAt":"2026-01-15T09:35:00.123456Z"}
                ]}
                """.trimIndent(),
                JsonCompareMode.LENIENT,
            )
        get("/api/conversations/$id/messages", TestTokens.user(grace))
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.messages[0].text")
            .isEqualTo("Vor eurer Zeit")
    }

    @Test
    fun `only an Admin adds Members, and only Users that exist`() {
        val ada = provision()
        val alan = provision()
        val id = create(ada, members = listOf(alan))

        expectCode(addMembers(alan, id, listOf(provision())), "NOT_CHANNEL_ADMIN")
        expectCode(addMembers(ada, id, listOf(provision(), UUID.randomUUID())), "NOT_FOUND")
        expectCode(addMembers(ada, 1, listOf(provision())), "NOT_CHANNEL_ADMIN")
        get("/api/conversations/$id", TestTokens.user(ada))
            .expectBody()
            .jsonPath("$.members.length()")
            .isEqualTo(2)
    }

    @Test
    fun `a removed Member loses the Channel at once`() {
        val ada = provision()
        val alan = provision()
        val id = create(ada, members = listOf(alan))

        removeMember(ada, id, alan)
            .expectStatus()
            .isOk
            .expectBody()
            .json("""{"userId":"$alan","isAdmin":false}""", JsonCompareMode.LENIENT)

        get("/api/conversations/$id", TestTokens.user(alan)).expectStatus().isNotFound
        get("/api/conversations/$id/messages", TestTokens.user(alan)).expectStatus().isNotFound
    }

    @Test
    fun `undoing a removal restores the Admin flag and the original join time`() {
        val ada = provision()
        val alan = provision()
        val id = create(ada, members = listOf(alan))
        setAdmin(ada, id, alan, true).expectStatus().isOk
        val removed = removeMember(ada, id, alan).expectBody(String::class.java).returnResult().responseBody!!
        clock.set(clock.instant() + Duration.ofMinutes(5))

        put("/api/channels/$id/members/$alan", TestTokens.user(ada), removed)
            .expectStatus()
            .isOk
            .expectBody()
            .jsonPath("$.members[?(@.userId == '$alan')]")
            .isEqualTo(listOf(mapOf("userId" to "$alan", "isAdmin" to true, "joinedAt" to START)))
        canSee(alan, id)
        // Undoing twice changes nothing.
        put("/api/channels/$id/members/$alan", TestTokens.user(ada), removed)
            .expectBody()
            .jsonPath("$.members.length()")
            .isEqualTo(2)
    }

    @Test
    fun `nobody but an Admin removes, never the Creator or themselves`() {
        val ada = provision()
        val alan = provision()
        val grace = provision()
        val id = create(ada, members = listOf(alan, grace))
        setAdmin(ada, id, alan, true).expectStatus().isOk

        expectCode(removeMember(grace, id, alan), "NOT_CHANNEL_ADMIN")
        expectCode(removeMember(alan, id, ada), "CHANNEL_CREATOR_PROTECTED")
        expectCode(removeMember(alan, id, alan), "MANAGING_YOURSELF")
        expectCode(removeMember(ada, id, provision()), "NOT_FOUND")
        expectCode(removeMember(ada, 1, alan), "NOT_CHANNEL_ADMIN")
        expectCode(restore(grace, id, provision()), "NOT_CHANNEL_ADMIN")
        expectCode(restore(alan, id, ada), "CHANNEL_CREATOR_PROTECTED")
        expectCode(restore(alan, id, alan), "MANAGING_YOURSELF")
        expectCode(restore(ada, id, UUID.randomUUID()), "NOT_FOUND")
        listOf(ada, alan, grace).forEach { canSee(it, id) }
    }

    @Test
    fun `a Member or an Admin leaves and loses the Channel`() {
        val ada = provision()
        val alan = provision()
        val grace = provision()
        val id = create(ada, members = listOf(alan, grace))
        setAdmin(ada, id, alan, true).expectStatus().isOk

        listOf(alan, grace).forEach {
            leave(it, id).expectStatus().isNoContent
            get("/api/conversations/$id", TestTokens.user(it)).expectStatus().isNotFound
        }
        get("/api/conversations/$id", TestTokens.user(ada))
            .expectBody()
            .jsonPath("$.members.length()")
            .isEqualTo(1)
    }

    @Test
    fun `the Creator can't leave, and nobody leaves the Default Channel`() {
        val ada = provision()
        val id = create(ada)

        expectCode(leave(ada, id), "CHANNEL_CREATOR_PROTECTED")
        expectCode(leave(ada, 1), "DEFAULT_CHANNEL_LOCKED")
        leave(provision(), id).expectStatus().isNotFound
        listOf(1, id).forEach { canSee(ada, it) }
    }

    private fun leave(
        user: UUID,
        id: Long,
    ) = post("/api/channels/$id/leave", TestTokens.user(user), "{}")

    private fun canSee(
        user: UUID,
        id: Long,
    ) {
        get("/api/conversations/$id", TestTokens.user(user)).expectStatus().isOk
    }

    private fun restore(
        actor: UUID,
        id: Long,
        member: UUID,
    ) = put(
        "/api/channels/$id/members/$member",
        TestTokens.user(actor),
        """{"isAdmin":true,"joinedAt":"$START"}""",
    )

    private fun removeMember(
        actor: UUID,
        id: Long,
        member: UUID,
    ) = delete("/api/channels/$id/members/$member", TestTokens.user(actor))

    private fun addMembers(
        actor: UUID,
        id: Long,
        userIds: List<UUID>,
    ) = post("/api/channels/$id/members", TestTokens.user(actor), json.writeValueAsString(mapOf("userIds" to userIds)))

    private fun setAdmin(
        actor: UUID,
        id: Long,
        member: UUID,
        isAdmin: Boolean,
    ) = put("/api/channels/$id/members/$member/admin", TestTokens.user(actor), """{"isAdmin":$isAdmin}""")

    private fun expectCode(
        response: RestTestClient.ResponseSpec,
        code: String,
    ) {
        response
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo(code)
    }

    private fun edit(
        user: UUID,
        id: Long,
        body: String,
    ) = patch("/api/channels/$id", TestTokens.user(user), body)

    /** The Channel [name] of [creator], joined by the [members]; its id. */
    private fun create(
        creator: UUID,
        name: String = "Marketing",
        members: List<UUID> = emptyList(),
    ): Long =
        post(
            "/api/channels",
            TestTokens.user(creator),
            json.writeValueAsString(
                mapOf("name" to name, "addDefaultChannelMembers" to false, "memberIds" to members),
            ),
        ).expectStatus()
            .isCreated
            .expectBody(ConversationDto::class.java)
            .returnResult()
            .responseBody!!
            .id

    private companion object {
        // When the test clock starts, and the Channels in these tests are created.
        const val START = "2026-01-15T09:30:00.123456Z"
    }

    private fun provision(sub: UUID = UUID.randomUUID()): UUID {
        get("/api/me", TestTokens.user(sub)).expectStatus().isOk
        return sub
    }
}
