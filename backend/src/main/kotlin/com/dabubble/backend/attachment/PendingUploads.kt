package com.dabubble.backend.attachment

import com.dabubble.backend.message.Attachment
import com.dabubble.backend.message.Message
import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import com.dabubble.backend.storage.FileDeletions
import com.dabubble.backend.storage.ObjectStorage
import com.dabubble.backend.time.now
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Duration
import java.util.UUID

/**
 * Uses Pending Uploads: each one only by its uploader, only once, and only once its file is in storage. One
 * unused for [MAX_AGE] is swept.
 */
@Component
class PendingUploads(
    private val pendingUploads: PendingUploadRepository,
    private val storage: ObjectStorage,
    private val files: FileDeletions,
    private val clock: Clock,
) {
    /**
     * The Attachments the Pending Uploads [ids] of [uploaderId] become, in that order; the Pending Uploads are
     * used up. An image whose thumbnail never arrived becomes an Attachment without one.
     */
    fun useAsAttachments(
        uploaderId: UUID,
        ids: List<Long>,
    ): List<Attachment> {
        val distinct = ids.distinct()
        if (distinct.isEmpty()) {
            return emptyList()
        }
        // Before asking storage about any of them.
        if (distinct.size > Message.MAX_ATTACHMENTS) {
            throw ProblemException(ProblemCode.TOO_MANY_ATTACHMENTS, "At most ${Message.MAX_ATTACHMENTS} Attachments")
        }
        val uploads = find(uploaderId, distinct, PendingUploadKind.ATTACHMENT)
        val attachments = uploads.map(::toAttachment)
        pendingUploads.deleteAll(uploads)
        return attachments
    }

    /**
     * Stores [image], an Avatar of [contentType] the backend made itself, as a Pending Upload of [uploaderId].
     * Inside the transaction: if storage fails, the Pending Upload is never committed.
     */
    fun avatar(
        uploaderId: UUID,
        image: ByteArray,
        contentType: String,
    ): PendingUpload {
        val upload =
            pendingUploads.save(PendingUpload.avatar(uploaderId, image.size.toLong(), contentType, clock.now()))
        storage.put(upload.objectKey, image, contentType)
        return upload
    }

    /** The key of the Avatar the Pending Upload [id] of [uploaderId] holds; the Pending Upload is used up. */
    fun useAsAvatar(
        uploaderId: UUID,
        id: Long,
    ): String {
        val upload = find(uploaderId, listOf(id), PendingUploadKind.AVATAR).single()
        pendingUploads.delete(upload)
        return upload.objectKey
    }

    /** Discards the Pending Uploads unused for [MAX_AGE]; their files go once committed. */
    @Transactional
    fun sweep() {
        val expired = pendingUploads.findByCreatedAtLessThanEqual(clock.now() - MAX_AGE)
        pendingUploads.deleteAll(expired)
        files.deleteAfterCommit(expired.flatMap { it.objectKeys })
    }

    /** The Pending Uploads [ids] of [uploaderId] for [kind], in that order; one used already is gone. */
    private fun find(
        uploaderId: UUID,
        ids: List<Long>,
        kind: PendingUploadKind,
    ): List<PendingUpload> {
        val found = pendingUploads.findByIdInAndUploaderIdAndKind(ids, uploaderId, kind).associateBy { it.id }
        return ids.map {
            found[it] ?: throw ProblemException(ProblemCode.UPLOAD_NOT_FOUND, "No Pending Upload $it of the User")
        }
    }

    /** Confirms with storage that [upload]'s file arrived whole; HeadObject, as the browser uploaded it. */
    private fun toAttachment(upload: PendingUpload): Attachment {
        if (storage.sizeOf(upload.objectKey) != upload.size) {
            throw ProblemException(ProblemCode.UPLOAD_INCOMPLETE, "Pending Upload ${upload.id} isn't uploaded")
        }
        return Attachment.of(upload, hasThumbnail = upload.thumbnailKey?.let(storage::sizeOf) != null)
    }

    private companion object {
        val MAX_AGE: Duration = Duration.ofHours(24)
    }
}
