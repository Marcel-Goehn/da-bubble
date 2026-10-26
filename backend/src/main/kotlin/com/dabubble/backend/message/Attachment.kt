package com.dabubble.backend.message

import com.dabubble.backend.attachment.AttachmentTypes.isImage
import com.dabubble.backend.attachment.PendingUpload
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

/** A file sent as part of a Message; part of the Message aggregate. Its object stays where it was uploaded. */
@Entity
@Table(name = "attachments")
class Attachment private constructor(
    val objectKey: String,
    /** An image's thumbnail; `null` for other files, or an image whose thumbnail never arrived. */
    val thumbnailKey: String?,
    val name: String,
    val size: Long,
    val contentType: String,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    /**
     * Where its file is stored, and an image's thumbnail: one that hadn't arrived when it was sent may arrive
     * later, as its upload URL is still valid, so its key is listed either way.
     */
    val objectKeys: List<String>
        get() {
            val thumbnail = thumbnailKey ?: PendingUpload.thumbnailKeyOf(objectKey).takeIf { isImage(contentType) }
            return listOfNotNull(objectKey, thumbnail)
        }

    companion object {
        /** The Attachment [upload] becomes, with its thumbnail only if [hasThumbnail]. */
        fun of(
            upload: PendingUpload,
            hasThumbnail: Boolean,
        ) = Attachment(
            objectKey = upload.objectKey,
            thumbnailKey = upload.thumbnailKey.takeIf { hasThumbnail },
            name = upload.name,
            size = upload.size,
            contentType = upload.contentType,
        )
    }
}
