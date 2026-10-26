package com.dabubble.backend.user

import com.dabubble.backend.attachment.FileCleanup
import com.dabubble.backend.realtime.UserUpdatedEvent
import com.dabubble.backend.support.StompTestSession
import com.dabubble.backend.support.StorageApiTest
import com.dabubble.backend.support.TestTokens
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.client.MultipartBodyBuilder
import org.springframework.test.web.servlet.client.RestTestClient
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.Base64
import java.util.UUID
import javax.imageio.ImageIO

class AvatarUploadApiTest : StorageApiTest() {
    @Autowired
    private lateinit var cleanup: FileCleanup

    @Test
    fun `an uploaded PNG is cropped to its centre square and stored as a 256 px JPEG`() {
        val token = provision()

        val upload = uploadAvatar(token, wideImage("png"), "image/png").avatarUpload()

        val stored = download(upload.url)
        assertEquals("image/jpeg", stored.contentType)
        val image = ImageIO.read(stored.bytes.inputStream())
        assertEquals(256, image.width)
        assertEquals(256, image.height)
        // The red sides were cropped away; only the blue centre is left, up to the corners.
        listOf(0 to 0, 255 to 0, 0 to 255, 255 to 255, 128 to 128).forEach { (x, y) ->
            assertTrue(isBlue(image.getRGB(x, y)), "pixel $x,$y")
        }
    }

    @Test
    fun `a WebP is read too`() {
        val token = provision()
        // 40 × 20, lossless: red sides and a blue 20 × 20 centre.
        val webp =
            Base64.getDecoder().decode("UklGRiwAAABXRUJQVlA4TB8AAAAvJ8AEAA8Q87//8x8OFLKNAN3j73RmEziAiP4H1bgHAA==")

        val upload = uploadAvatar(token, webp, "image/webp").avatarUpload()

        val image = ImageIO.read(download(upload.url).bytes.inputStream())
        assertEquals(256, image.width)
        assertTrue(isBlue(image.getRGB(0, 0)))
    }

    @Test
    fun `the re-encode drops a JPEG's EXIF metadata, location included`() {
        val token = provision()
        val jpeg = withExif(wideImage("jpg"))
        assertTrue(jpeg.containsAscii("Exif"))

        val upload = uploadAvatar(token, jpeg, "image/jpeg").avatarUpload()

        assertFalse(download(upload.url).bytes.containsAscii("Exif"))
    }

    @Test
    fun `a phone photo is turned upright by its EXIF orientation before the metadata goes`() {
        val token = provision()
        // Stored sideways: the camera says to show it turned 90° clockwise, which brings its left to the top.
        val jpeg = withOrientation(halvesImage(), orientation = 6)

        val upload = uploadAvatar(token, jpeg, "image/jpeg").avatarUpload()

        val image = ImageIO.read(download(upload.url).bytes.inputStream())
        assertTrue(isBlue(image.getRGB(128, 20)), "top")
        assertTrue(isGreen(image.getRGB(128, 235)), "bottom")
    }

    @Test
    fun `the type comes from the bytes, not from what the browser claims`() {
        val token = provision()

        uploadAvatar(token, wideImage("png"), "image/gif").expectStatus().isCreated
        expectProblem(uploadAvatar(token, wideImage("gif"), "image/png"), 415, "AVATAR_TYPE_UNSUPPORTED")
        expectProblem(
            uploadAvatar(token, "not an image".toByteArray(), "image/jpeg"),
            415,
            "AVATAR_TYPE_UNSUPPORTED",
        )
    }

    @Test
    fun `a PNG whose bytes break off after the header is refused`() {
        val token = provision()

        expectProblem(uploadAvatar(token, wideImage("png").copyOf(40), "image/png"), 415, "AVATAR_TYPE_UNSUPPORTED")
    }

    @Test
    fun `a file over 5 MB is refused, one of exactly 5 MB is read`() {
        val token = provision()
        val limit = 5 * 1024 * 1024
        val png = wideImage("png")

        expectProblem(uploadAvatar(token, png.copyOf(limit + 1), "image/png"), 413, "AVATAR_TOO_LARGE")
        // Padded after the image's end, which readers ignore.
        uploadAvatar(token, png.copyOf(limit), "image/png").expectStatus().isCreated
    }

    @Test
    fun `a file far over the limit gets the same problem`() {
        val token = provision()

        expectProblem(uploadAvatar(token, ByteArray(12 * 1024 * 1024), "image/png"), 413, "AVATAR_TOO_LARGE")
    }

    @Test
    fun `the Guest can't upload an Avatar`() {
        expectProblem(uploadAvatar(TestTokens.guest(), wideImage("png"), "image/png"), 403, "GUEST_PROFILE_LOCKED")
    }

    @Test
    fun `saving an upload makes it the User's Avatar, everywhere live`() {
        val sub = UUID.randomUUID()
        val token = provision(sub)
        val alanTab = stomp.connect(provision())
        val upload = uploadAvatar(token, wideImage("png"), "image/png").avatarUpload()

        val saved = setAvatar(token, """{"uploadId":${upload.id}}""").user()

        assertNull(saved.avatar)
        assertTrue(isStored(saved.uploadedAvatarUrl!!))
        assertEquals(sub, awaitUserUpdate(alanTab).user.id)
        val seen = getUser(sub, TestTokens.user())
        assertNull(seen.avatar)
        assertEquals(download(upload.url).bytes.toList(), download(seen.uploadedAvatarUrl!!).bytes.toList())
    }

    @Test
    fun `an upload is saved only once, and only by its uploader`() {
        val ada = provision()
        val alan = provision()
        val upload = uploadAvatar(ada, wideImage("png"), "image/png").avatarUpload()

        expectProblem(setAvatar(alan, """{"uploadId":${upload.id}}"""), 400, "UPLOAD_NOT_FOUND")
        setAvatar(ada, """{"uploadId":${upload.id}}""").expectStatus().isOk
        expectProblem(setAvatar(ada, """{"uploadId":${upload.id}}"""), 400, "UPLOAD_NOT_FOUND")
    }

    @Test
    fun `an Avatar upload isn't an Attachment, and an Attachment upload isn't an Avatar`() {
        val ada = provision()
        val avatar = uploadAvatar(ada, wideImage("png"), "image/png").avatarUpload()
        val attachment = upload(ada, "Plan.pdf", "%PDF-1", "application/pdf")

        expectProblem(send(ada, 1, "", listOf(avatar.id)), 400, "UPLOAD_NOT_FOUND")
        expectProblem(setAvatar(ada, """{"uploadId":${attachment.id}}"""), 400, "UPLOAD_NOT_FOUND")
    }

    @Test
    fun `a request names a predefined Avatar or an upload, not both or neither`() {
        val ada = provision()
        val upload = uploadAvatar(ada, wideImage("png"), "image/png").avatarUpload()

        expectProblem(setAvatar(ada, """{"avatar":"AVATAR_1","uploadId":${upload.id}}"""), 400, "BAD_REQUEST")
        expectProblem(setAvatar(ada, "{}"), 400, "BAD_REQUEST")
    }

    @Test
    fun `a replaced uploaded Avatar is deleted from storage`() {
        val ada = provision()
        val first = uploadAvatar(ada, wideImage("png"), "image/png").avatarUpload()
        val firstUrl = setAvatar(ada, """{"uploadId":${first.id}}""").user().uploadedAvatarUrl!!
        val second = uploadAvatar(ada, wideImage("png"), "image/png").avatarUpload()

        val secondUrl = setAvatar(ada, """{"uploadId":${second.id}}""").user().uploadedAvatarUrl!!
        assertFalse(isStored(firstUrl))
        assertTrue(isStored(secondUrl))

        val predefined = setAvatar(ada, """{"avatar":"AVATAR_4"}""").user()
        assertEquals(PredefinedAvatar.AVATAR_4, predefined.avatar)
        assertNull(predefined.uploadedAvatarUrl)
        assertFalse(isStored(secondUrl))
    }

    @Test
    fun `an upload that is never saved is swept after 24 hours`() {
        cleanup.start()
        val ada = provision()
        val upload = uploadAvatar(ada, wideImage("png"), "image/png").avatarUpload()

        repeat(24) {
            clock.set(clock.instant() + FileCleanup.INTERVAL)
            scheduler.runDue(clock.instant())
        }

        assertFalse(isStored(upload.url))
        expectProblem(setAvatar(ada, """{"uploadId":${upload.id}}"""), 400, "UPLOAD_NOT_FOUND")
    }

    private fun uploadAvatar(
        token: String,
        bytes: ByteArray,
        contentType: String,
    ): RestTestClient.ResponseSpec {
        val parts =
            MultipartBodyBuilder()
                .apply {
                    part("file", bytes, MediaType.parseMediaType(contentType)).filename("foto")
                }.build()
        return client
            .post()
            .uri("/api/me/avatar/uploads")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(parts)
            .exchange()
    }

    private fun setAvatar(
        token: String,
        json: String,
    ) = put("/api/me/avatar", token, json)

    private fun RestTestClient.ResponseSpec.avatarUpload(): AvatarUploadDto =
        expectStatus()
            .isCreated
            .expectBody(AvatarUploadDto::class.java)
            .returnResult()
            .responseBody!!

    private fun RestTestClient.ResponseSpec.user(): UserDto =
        expectStatus()
            .isOk
            .expectBody(UserDto::class.java)
            .returnResult()
            .responseBody!!

    private fun getUser(
        id: UUID,
        token: String,
    ): UserDto = get("/api/users/$id", token).user()

    private fun awaitUserUpdate(tab: StompTestSession): UserUpdatedEvent =
        generateSequence { tab.awaitWorkspaceEvent() }.filterIsInstance<UserUpdatedEvent>().first()

    private class Stored(
        val bytes: ByteArray,
        val contentType: String?,
    )

    private fun download(url: String): Stored {
        val response =
            HttpClient
                .newHttpClient()
                .send(HttpRequest.newBuilder(URI(url)).GET().build(), HttpResponse.BodyHandlers.ofByteArray())
        assertEquals(200, response.statusCode())
        return Stored(response.body(), response.headers().firstValue("Content-Type").orElse(null))
    }

    private companion object {
        /** 400 × 200 in [format]: red sides and a blue 200 × 200 square in the centre. */
        fun wideImage(format: String): ByteArray {
            val image = BufferedImage(400, 200, BufferedImage.TYPE_INT_RGB)
            val graphics = image.createGraphics()
            graphics.color = Color.RED
            graphics.fillRect(0, 0, 400, 200)
            graphics.color = Color.BLUE
            graphics.fillRect(100, 0, 200, 200)
            graphics.dispose()
            return ByteArrayOutputStream().also { ImageIO.write(image, format, it) }.toByteArray()
        }

        /** [jpeg] with an APP1 EXIF segment, as a phone camera writes one, right after its start marker. */
        fun withExif(jpeg: ByteArray): ByteArray {
            val payload = "Exif\u0000\u0000GPS 52.52N 13.40E".toByteArray(Charsets.ISO_8859_1)
            val length = payload.size + 2
            val segment = byteArrayOf(0xFF.toByte(), 0xE1.toByte(), (length shr 8).toByte(), length.toByte())
            return jpeg.copyOfRange(0, 2) + segment + payload + jpeg.copyOfRange(2, jpeg.size)
        }

        /** 400 × 200 JPEG: red sides, and a centre square whose left half is blue and right half green. */
        fun halvesImage(): ByteArray {
            val image = BufferedImage(400, 200, BufferedImage.TYPE_INT_RGB)
            val graphics = image.createGraphics()
            graphics.color = Color.RED
            graphics.fillRect(0, 0, 400, 200)
            graphics.color = Color.BLUE
            graphics.fillRect(100, 0, 100, 200)
            graphics.color = Color.GREEN
            graphics.fillRect(200, 0, 100, 200)
            graphics.dispose()
            return ByteArrayOutputStream().also { ImageIO.write(image, "jpg", it) }.toByteArray()
        }

        /** [jpeg] with an EXIF segment holding only the Orientation tag, big-endian as many cameras write it. */
        fun withOrientation(
            jpeg: ByteArray,
            orientation: Int,
        ): ByteArray {
            val tiff =
                byteArrayOf(0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08) +
                    byteArrayOf(0x00, 0x01) +
                    // Tag 0x0112, type SHORT, count 1, the value padded to 4 bytes.
                    byteArrayOf(0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01) +
                    byteArrayOf(0x00, orientation.toByte(), 0x00, 0x00) +
                    byteArrayOf(0x00, 0x00, 0x00, 0x00)
            val payload = "Exif\u0000\u0000".toByteArray(Charsets.ISO_8859_1) + tiff
            val length = payload.size + 2
            val segment = byteArrayOf(0xFF.toByte(), 0xE1.toByte(), (length shr 8).toByte(), length.toByte())
            return jpeg.copyOfRange(0, 2) + segment + payload + jpeg.copyOfRange(2, jpeg.size)
        }

        fun isGreen(rgb: Int): Boolean {
            val color = Color(rgb)
            return color.green > 200 && color.red < 60 && color.blue < 60
        }

        fun ByteArray.containsAscii(text: String) = String(this, Charsets.ISO_8859_1).contains(text)

        fun isBlue(rgb: Int): Boolean {
            val color = Color(rgb)
            return color.blue > 200 && color.red < 60 && color.green < 60
        }
    }
}
