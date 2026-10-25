package com.dabubble.backend.attachment

import org.springframework.http.ContentDisposition
import org.springframework.http.InvalidMediaTypeException
import org.springframework.http.MediaType

/** The rules that depend on an Attachment's type, as its uploader's browser named it; never sniffed. */
object AttachmentTypes {
    /** The type of the browser-made thumbnails. */
    const val THUMBNAIL_TYPE = "image/webp"

    private val images = setOf("image/jpeg", "image/png", "image/webp", "image/gif")

    // Those a browser shows rather than runs; every other type is downloaded.
    private val inlineSafe =
        images +
            setOf(
                "application/pdf",
                "video/mp4",
                "video/webm",
                "audio/mpeg",
                "audio/ogg",
                "video/ogg",
                "application/ogg",
                "audio/wav",
                "audio/x-wav",
                "audio/wave",
                "text/plain",
            )

    /** Whether [contentType] is a valid media type such as `image/png`. */
    fun isValid(contentType: String): Boolean =
        try {
            MediaType.parseMediaType(contentType).isConcrete
        } catch (_: InvalidMediaTypeException) {
            false
        }

    /** Whether an Attachment of [contentType] is shown as a thumbnail and gets one made. */
    fun isImage(contentType: String): Boolean = baseType(contentType) in images

    /**
     * How the file [name] of [contentType] is served: inline if it's safe to open in a tab and not to be
     * [downloaded], otherwise as an attachment. Either way under its original name.
     */
    fun contentDisposition(
        name: String,
        contentType: String,
        downloaded: Boolean = false,
    ): String {
        val builder =
            if (!downloaded && baseType(contentType) in inlineSafe) {
                ContentDisposition.inline()
            } else {
                ContentDisposition.attachment()
            }
        return builder.filename(name, Charsets.UTF_8).build().toString()
    }

    private fun baseType(contentType: String): String {
        val type = MediaType.parseMediaType(contentType)
        return "${type.type}/${type.subtype}".lowercase()
    }
}
