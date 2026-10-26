package com.dabubble.backend.user

import com.dabubble.backend.attachment.PendingUploads
import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import com.dabubble.backend.realtime.RealtimePublisher
import com.dabubble.backend.realtime.UserUpdatedEvent
import com.dabubble.backend.storage.FileDeletions
import io.swagger.v3.oas.annotations.media.Schema
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

/** Exactly one of [avatar] and [uploadId]. */
data class SetAvatarRequest(
    /** One of the predefined Avatars. */
    val avatar: PredefinedAvatar? = null,
    /** An Avatar the User uploaded and hasn't used yet. */
    val uploadId: Long? = null,
)

// springdoc doesn't infer `required` from Kotlin nullability; only properties with defaults are optional.
data class RenameRequest(
    /** Trimmed; 1 to 50 characters. */
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val name: String,
)

/** An uploaded Avatar, waiting to be saved. */
data class AvatarUploadDto(
    /** The Pending Upload, to save as the Avatar. */
    val id: Long,
    /** Shows the Avatar for 5 minutes, as it will look. */
    val url: String,
)

/** The logged-in User: their profile, and changing their name and Avatar, which the Guest can't. */
@RestController
@RequestMapping("/api/me")
@Tag(name = "me")
class MeController(
    private val users: UserRepository,
    private val views: UserViews,
    private val uploads: PendingUploads,
    private val files: FileDeletions,
    private val publisher: RealtimePublisher,
) {
    // Getting here has already provisioned the User (CurrentUserFilter).
    @GetMapping
    fun getMe(user: User): UserDto = views.toDto(user)

    @PutMapping("/name")
    @Transactional
    fun rename(
        user: User,
        @RequestBody request: RenameRequest,
    ): UserDto {
        user.rename(request.name)
        return saved(user)
    }

    /**
     * Gives the User a predefined Avatar or the one they uploaded. An uploaded Avatar it replaces is deleted.
     * An unknown predefined id never binds, so it is a BAD_REQUEST problem, as is the Guest's.
     */
    @PutMapping("/avatar")
    @Transactional
    fun setAvatar(
        user: User,
        @RequestBody request: SetAvatarRequest,
    ): UserDto {
        val replaced =
            when {
                request.avatar != null && request.uploadId == null -> {
                    user.pickAvatar(request.avatar)
                }

                request.avatar == null && request.uploadId != null -> {
                    // Before the upload is used up, so the Guest's stays theirs.
                    user.requireEditable()
                    user.useUploadedAvatar(uploads.useAsAvatar(user.id, request.uploadId))
                }

                else -> {
                    throw ProblemException(ProblemCode.BAD_REQUEST, "Either a predefined Avatar or an upload")
                }
            }
        files.deleteAfterCommit(listOfNotNull(replaced))
        return saved(user)
    }

    /**
     * Uploads a picture as the User's next Avatar: a JPG, PNG or WebP of at most 5 MB, cropped to its centred
     * square and stored at 256 px without its metadata. It stays a Pending Upload until it's saved.
     */
    @PostMapping("/avatar/uploads", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    @Transactional
    @ResponseStatus(HttpStatus.CREATED)
    fun uploadAvatar(
        user: User,
        @RequestPart file: MultipartFile,
    ): AvatarUploadDto {
        user.requireEditable()
        val upload = uploads.avatar(user.id, AvatarImages.reencode(file.bytes), AvatarImages.CONTENT_TYPE)
        return AvatarUploadDto(checkNotNull(upload.id), views.avatarUrl(upload.objectKey))
    }

    /** Stores [user] and, once committed, shows the change to the whole Workspace. */
    private fun saved(user: User): UserDto {
        val dto = views.toDto(users.save(user))
        publisher.toWorkspaceAfterCommit(UserUpdatedEvent(dto))
        return dto
    }
}
