package com.dabubble.backend.attachment

import com.dabubble.backend.conversation.ConversationRepository
import com.dabubble.backend.conversation.requireVisibleTo
import com.dabubble.backend.message.AttachmentUrlDto
import com.dabubble.backend.message.MessageRepository
import com.dabubble.backend.message.requireIn
import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import com.dabubble.backend.storage.ObjectStorage
import com.dabubble.backend.time.now
import com.dabubble.backend.user.User
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Clock
import java.time.Duration

/** Attachments: uploading one for a Message, and opening one. */
@RestController
@Tag(name = "attachments")
class AttachmentController(
    private val conversations: ConversationRepository,
    private val messages: MessageRepository,
    private val urls: AttachmentUrls,
    private val pendingUploads: PendingUploadRepository,
    private val storage: ObjectStorage,
    private val clock: Clock,
) {
    /**
     * Starts an Attachment upload: a Pending Upload, and presigned PUTs for the file and an image's thumbnail.
     * The 5 per Message are checked when it's sent.
     */
    @PostMapping("/api/attachments/uploads")
    @Transactional
    @ResponseStatus(HttpStatus.CREATED)
    fun requestUpload(
        user: User,
        @RequestBody request: RequestUploadRequest,
    ): AttachmentUploadDto {
        val upload =
            pendingUploads.save(
                PendingUpload.attachment(
                    uploaderId = user.id,
                    name = request.name,
                    size = request.size,
                    contentType = request.contentType,
                    thumbnailSize = request.thumbnailSize,
                    createdAt = clock.now(),
                ),
            )
        return AttachmentUploadDto(
            id = checkNotNull(upload.id),
            uploadUrl = storage.presignPut(upload.objectKey, upload.size, upload.contentType, UPLOAD_TTL),
            thumbnailUploadUrl =
                upload.thumbnailKey?.let {
                    val size = checkNotNull(request.thumbnailSize)
                    storage.presignPut(it, size, AttachmentTypes.THUMBNAIL_TYPE, UPLOAD_TTL)
                },
        )
    }

    /**
     * A fresh URL to open the Attachment in a new tab, or to download it, for 1 minute. Only for someone who
     * can see its Conversation right now; an Attachment of a Deleted Message is gone.
     */
    @GetMapping("/api/conversations/{conversationId}/messages/{messageId}/attachments/{attachmentId}/url")
    @Transactional(readOnly = true)
    fun getAttachmentUrl(
        user: User,
        @PathVariable conversationId: Long,
        @PathVariable messageId: Long,
        @PathVariable attachmentId: Long,
        /** Whether to download it even if it could be shown in the browser. */
        @RequestParam(defaultValue = "false") download: Boolean,
    ): AttachmentUrlDto {
        conversations.requireVisibleTo(conversationId, user.id)
        val attachment =
            messages.requireIn(conversationId, messageId).attachments.find { it.id == attachmentId }
                ?: throw ProblemException(ProblemCode.NOT_FOUND, "No Attachment $attachmentId on Message $messageId")
        return urls.open(attachment, download)
    }

    private companion object {
        val UPLOAD_TTL: Duration = Duration.ofMinutes(5)
    }
}
