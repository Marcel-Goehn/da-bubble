package com.dabubble.backend.attachment

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * A file a User has requested an upload for but not yet used. Only its uploader may use it; sending it turns
 * it into an Attachment, with the object staying under the same key.
 */
@Entity
@Table(name = "pending_uploads")
class PendingUpload private constructor(
    val uploaderId: UUID,
    val objectKey: String,
    /** Where an image's thumbnail goes; `null` for other files, or when the browser couldn't make one. */
    val thumbnailKey: String?,
    val name: String,
    /** The exact size in bytes the upload was signed for. */
    val size: Long,
    val contentType: String,
    val createdAt: Instant,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    /** Where its file is stored, and its thumbnail if it's meant to have one. */
    val objectKeys: List<String> get() = listOfNotNull(objectKey, thumbnailKey)

    companion object {
        /** 25 MB, per file. */
        const val MAX_SIZE: Long = 25L * 1024 * 1024
        private const val MAX_NAME_LENGTH = 255

        /**
         * An Attachment upload of the file [name] with [size] bytes of [contentType], under a random key. An
         * image also gets a key for its thumbnail of [thumbnailSize] bytes, if the browser made one.
         */
        fun attachment(
            uploaderId: UUID,
            name: String,
            size: Long,
            contentType: String,
            thumbnailSize: Long?,
            createdAt: Instant,
        ): PendingUpload {
            val trimmed = name.trim()
            requireWellFormed(trimmed, contentType, listOfNotNull(size, thumbnailSize))
            if (size > MAX_SIZE || (thumbnailSize ?: 0) > MAX_SIZE) {
                throw ProblemException(ProblemCode.ATTACHMENT_TOO_LARGE, "A file may have at most $MAX_SIZE bytes")
            }
            val key = "attachments/${UUID.randomUUID()}"
            val hasThumbnail = thumbnailSize != null && AttachmentTypes.isImage(contentType)
            val thumbnailKey = thumbnailKeyOf(key).takeIf { hasThumbnail }
            return PendingUpload(uploaderId, key, thumbnailKey, trimmed, size, contentType, createdAt)
        }

        /** Where the thumbnail of the image stored at [objectKey] goes. */
        fun thumbnailKeyOf(objectKey: String) = "$objectKey-thumb"

        private fun requireWellFormed(
            name: String,
            contentType: String,
            sizes: List<Long>,
        ) {
            val wellFormed =
                name.isNotEmpty() &&
                    name.length <= MAX_NAME_LENGTH &&
                    sizes.all { it > 0 } &&
                    AttachmentTypes.isValid(contentType)
            if (!wellFormed) {
                throw ProblemException(ProblemCode.BAD_REQUEST, "An upload needs a name, sizes and a media type")
            }
        }
    }
}
