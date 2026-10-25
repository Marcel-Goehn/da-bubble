package com.dabubble.backend.attachment

import io.swagger.v3.oas.annotations.media.Schema

/** Where the browser PUTs a requested upload; each URL works for 5 minutes. */
data class AttachmentUploadDto(
    /** The Pending Upload, to send with a Message once both PUTs are done. */
    val id: Long,
    /** Takes exactly the announced size and type as `Content-Length` and `Content-Type`. */
    val uploadUrl: String,
    /** For an image with a thumbnail: takes exactly the thumbnail's size as `image/webp`. */
    val thumbnailUploadUrl: String?,
)

data class RequestUploadRequest(
    /** The file's name, as it's shown and downloaded. */
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val name: String,
    /** The file's size in bytes; at most 25 MB. */
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val size: Long,
    @field:Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    val contentType: String,
    /** For an image, the size in bytes of the 320 px WebP thumbnail the browser made, if it could. */
    val thumbnailSize: Long? = null,
)
