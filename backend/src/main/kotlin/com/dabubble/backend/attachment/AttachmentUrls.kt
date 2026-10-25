package com.dabubble.backend.attachment

import com.dabubble.backend.message.Attachment
import com.dabubble.backend.message.AttachmentDto
import com.dabubble.backend.message.AttachmentUrlDto
import com.dabubble.backend.storage.ObjectStorage
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * Presigned GETs for Attachments, which storage serves under the original file name: inline only for the
 * types a browser shows safely, otherwise as a download.
 */
@Component
class AttachmentUrls(
    private val storage: ObjectStorage,
) {
    /** [attachment] as Messages carry it, with URLs to show it for 5 minutes. */
    fun toDto(attachment: Attachment): AttachmentDto =
        AttachmentDto(
            id = checkNotNull(attachment.id),
            name = attachment.name,
            size = attachment.size,
            contentType = attachment.contentType,
            url = presign(attachment, downloaded = false, SHOW_TTL),
            thumbnailUrl = attachment.thumbnailKey?.let { storage.presignGet(it, "inline", SHOW_TTL) },
        )

    /** A URL that opens [attachment] for 1 minute, or [downloaded] it whatever its type. */
    fun open(
        attachment: Attachment,
        downloaded: Boolean,
    ): AttachmentUrlDto = AttachmentUrlDto(presign(attachment, downloaded, OPEN_TTL))

    private fun presign(
        attachment: Attachment,
        downloaded: Boolean,
        ttl: Duration,
    ): String {
        val disposition = AttachmentTypes.contentDisposition(attachment.name, attachment.contentType, downloaded)
        return storage.presignGet(attachment.objectKey, disposition, ttl)
    }

    private companion object {
        val SHOW_TTL: Duration = Duration.ofMinutes(5)
        val OPEN_TTL: Duration = Duration.ofMinutes(1)
    }
}
