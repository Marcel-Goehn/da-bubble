package com.dabubble.backend.support

import com.dabubble.backend.attachment.AttachmentUploadDto
import com.dabubble.backend.message.MessageDto
import com.dabubble.backend.storage.ObjectStorage
import org.junit.jupiter.api.Assertions.assertEquals
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.client.RestTestClient
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

/** Base for tests that upload files to storage as the browser does, and check what's stored. */
abstract class StorageApiTest : IntegrationTest() {
    @Autowired
    private lateinit var storage: ObjectStorage

    protected fun provision(sub: UUID = UUID.randomUUID()): String {
        val token = TestTokens.user(sub)
        get("/api/me", token).expectStatus().isOk
        return token
    }

    /** A Pending Upload of [name] holding [content], uploaded as the browser would unless told not to. */
    protected fun upload(
        token: String,
        name: String,
        content: String,
        contentType: String,
        thumbnail: String? = null,
        putFile: Boolean = true,
        putThumbnail: Boolean = true,
    ): AttachmentUploadDto {
        val thumbnailSize = thumbnail?.let { ",\"thumbnailSize\":${it.length}" }.orEmpty()
        val upload =
            post(
                "/api/attachments/uploads",
                token,
                """{"name":"$name","size":${content.length},"contentType":"$contentType"$thumbnailSize}""",
            ).expectStatus()
                .isCreated
                .expectBody(AttachmentUploadDto::class.java)
                .returnResult()
                .responseBody!!
        if (putFile) {
            putObject(upload.uploadUrl, content, contentType)
        }
        if (thumbnail != null && putThumbnail) {
            putObject(upload.thumbnailUploadUrl!!, thumbnail, "image/webp")
        }
        return upload
    }

    /** Sends a Message with [text] and the Pending Uploads [uploadIds] to [conversationId]. */
    protected fun send(
        token: String,
        conversationId: Long,
        text: String,
        uploadIds: List<Long>,
    ): RestTestClient.ResponseSpec = post("/api/conversations/$conversationId/messages", token, body(text, uploadIds))

    /** A Message or Reply with [text] and the Pending Uploads [uploadIds]. */
    protected fun body(
        text: String,
        uploadIds: List<Long>,
    ) = """{"text":"$text","attachmentIds":[${uploadIds.joinToString()}]}"""

    protected fun RestTestClient.ResponseSpec.message(): MessageDto =
        expectBody(MessageDto::class.java)
            .returnResult()
            .responseBody!!

    /** Whether storage holds the object a presigned URL [url] points to; path-style, `/<bucket>/<key>`. */
    protected fun isStored(url: String): Boolean {
        val key =
            URI(url)
                .path
                .removePrefix("/")
                .substringAfter('/')
        return storage.sizeOf(key) != null
    }

    /** PUTs [body] to the presigned [url] as the browser would. */
    protected fun putObject(
        url: String,
        body: String,
        contentType: String,
    ) {
        val status =
            HttpClient
                .newHttpClient()
                .send(
                    HttpRequest
                        .newBuilder(URI(url))
                        .header("Content-Type", contentType)
                        .PUT(HttpRequest.BodyPublishers.ofString(body))
                        .build(),
                    HttpResponse.BodyHandlers.discarding(),
                ).statusCode()
        assertEquals(200, status)
    }
}
