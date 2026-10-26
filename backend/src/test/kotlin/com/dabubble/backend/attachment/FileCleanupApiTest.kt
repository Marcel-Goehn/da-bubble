package com.dabubble.backend.attachment

import com.dabubble.backend.conversation.ConversationDto
import com.dabubble.backend.support.StorageApiTest
import com.dabubble.backend.support.StorageOutage
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.Duration

class FileCleanupApiTest : StorageApiTest() {
    @Autowired
    private lateinit var cleanup: FileCleanup

    // Resetting the scheduler cancelled the cleanup the app scheduled at startup.
    @BeforeEach
    fun scheduleCleanup() {
        cleanup.start()
    }

    @Test
    fun `deleting a Message deletes its files and thumbnails`() {
        val ada = provision()
        val image = upload(ada, "Foto.png", "png!", "image/png", thumbnail = "webp")
        val file = upload(ada, "Plan.pdf", "%PDF-1", "application/pdf")
        val sent = send(ada, 1, "Schau", listOf(image.id, file.id)).expectStatus().isCreated.message()
        val urls = listOf(image.uploadUrl, image.thumbnailUploadUrl!!, file.uploadUrl)
        assertTrue(urls.all(::isStored))

        delete("/api/conversations/1/messages/${sent.id}", ada).expectStatus().isOk

        assertFalse(urls.any(::isStored))
    }

    @Test
    fun `deleting a Message deletes a thumbnail that arrived after it was sent`() {
        val ada = provision()
        val image = upload(ada, "Foto.png", "png!", "image/png", thumbnail = "webp", putThumbnail = false)
        val sent = send(ada, 1, "", listOf(image.id)).expectStatus().isCreated.message()
        putObject(image.thumbnailUploadUrl!!, "webp", "image/webp")

        delete("/api/conversations/1/messages/${sent.id}", ada).expectStatus().isOk

        assertFalse(isStored(image.thumbnailUploadUrl))
    }

    @Test
    fun `deleting a Channel deletes the files of its Messages and Replies`() {
        val ada = provision()
        val channelId =
            post("/api/channels", ada, """{"name":"Projekt","addDefaultChannelMembers":false,"memberIds":[]}""")
                .expectStatus()
                .isCreated
                .expectBody(ConversationDto::class.java)
                .returnResult()
                .responseBody!!
                .id
        val file = upload(ada, "Plan.pdf", "%PDF-1", "application/pdf")
        val parent = send(ada, channelId, "", listOf(file.id)).expectStatus().isCreated.message()
        val reply = upload(ada, "Foto.png", "png!", "image/png", thumbnail = "webp")
        post(
            "/api/conversations/$channelId/messages/${parent.id}/replies",
            ada,
            """{"text":"","attachmentIds":[${reply.id}]}""",
        ).expectStatus().isCreated
        val elsewhere = upload(ada, "Bleibt.txt", "ja", "text/plain")
        send(ada, 1, "", listOf(elsewhere.id)).expectStatus().isCreated
        val urls = listOf(file.uploadUrl, reply.uploadUrl, reply.thumbnailUploadUrl!!)
        assertTrue(urls.all(::isStored))

        delete("/api/channels/$channelId", ada).expectStatus().is2xxSuccessful

        assertFalse(urls.any(::isStored))
        assertTrue(isStored(elsewhere.uploadUrl))
    }

    @Test
    fun `files storage failed to delete are deleted by the next cleanup`() {
        val ada = provision()
        val file = upload(ada, "Plan.pdf", "%PDF-1", "application/pdf")
        val sent = send(ada, 1, "", listOf(file.id)).expectStatus().isCreated.message()
        StorageOutage.down = true

        delete("/api/conversations/1/messages/${sent.id}", ada).expectStatus().isOk
        StorageOutage.down = false

        assertTrue(isStored(file.uploadUrl))
        runCleanup()
        assertFalse(isStored(file.uploadUrl))
    }

    @Test
    fun `a failed retry is tried again at the next cleanup`() {
        val ada = provision()
        val file = upload(ada, "Plan.pdf", "%PDF-1", "application/pdf")
        val sent = send(ada, 1, "", listOf(file.id)).expectStatus().isCreated.message()
        StorageOutage.down = true
        delete("/api/conversations/1/messages/${sent.id}", ada).expectStatus().isOk

        runCleanup()
        StorageOutage.down = false

        assertTrue(isStored(file.uploadUrl))
        runCleanup()
        assertFalse(isStored(file.uploadUrl))
    }

    @Test
    fun `a Pending Upload unused for 24 hours is swept with its files`() {
        val ada = provision()
        val old = upload(ada, "Foto.png", "png!", "image/png", thumbnail = "webp")
        clock.set(clock.instant() + Duration.ofHours(1))
        val recent = upload(ada, "Plan.pdf", "%PDF-1", "application/pdf")

        // To 24 hours after the old one, 23 after the recent one.
        repeat(23) { runCleanup() }

        assertFalse(isStored(old.uploadUrl))
        assertFalse(isStored(old.thumbnailUploadUrl!!))
        send(ada, 1, "", listOf(old.id)).expectStatus().isBadRequest
        assertTrue(isStored(recent.uploadUrl))
        send(ada, 1, "", listOf(recent.id)).expectStatus().isCreated
    }

    @Test
    fun `a swept Pending Upload's files storage failed to delete are retried`() {
        val ada = provision()
        val old = upload(ada, "Plan.pdf", "%PDF-1", "application/pdf")
        StorageOutage.down = true

        repeat(24) { runCleanup() }
        StorageOutage.down = false

        assertTrue(isStored(old.uploadUrl))
        runCleanup()
        assertFalse(isStored(old.uploadUrl))
    }

    /** Moves the clock to the next cleanup, and runs it. */
    private fun runCleanup() {
        clock.set(clock.instant() + FileCleanup.INTERVAL)
        scheduler.runDue(clock.instant())
    }
}
