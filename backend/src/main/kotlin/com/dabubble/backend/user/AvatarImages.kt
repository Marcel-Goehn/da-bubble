package com.dabubble.backend.user

import com.dabubble.backend.problem.ProblemCode
import com.dabubble.backend.problem.ProblemException
import java.awt.Color
import java.awt.Rectangle
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.imageio.IIOImage
import javax.imageio.ImageIO
import javax.imageio.ImageWriteParam

/**
 * Turns an uploaded picture into an Avatar: a JPG, PNG or WebP of at most [MAX_SIZE] bytes, told apart by its
 * bytes, becomes its centred square at [PIXELS] px as a JPEG, turned upright as a JPEG's EXIF says. Re-encoding
 * keeps none of its metadata, so EXIF (location included) is gone.
 */
object AvatarImages {
    /** 5 MB. */
    const val MAX_SIZE: Long = 5L * 1024 * 1024
    const val CONTENT_TYPE = "image/jpeg"
    const val PIXELS = 256

    // A small file can claim huge dimensions; decoding one would take minutes and gigabytes.
    private const val MAX_SOURCE_PIXELS = 50_000_000L
    private const val QUALITY = 0.9f

    private val jpeg = byteArrayOf(0xFF, 0xD8, 0xFF)
    private val png = byteArrayOf(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)

    // A WebP is a RIFF container: "RIFF", its length in 4 bytes, then "WEBP".
    private val riff = "RIFF".toByteArray(Charsets.US_ASCII)
    private val webp = "WEBP".toByteArray(Charsets.US_ASCII)
    private const val WEBP_TAG_OFFSET = 8

    fun reencode(bytes: ByteArray): ByteArray {
        if (bytes.size > MAX_SIZE) {
            throw ProblemException(ProblemCode.AVATAR_TOO_LARGE, "An Avatar may have at most $MAX_SIZE bytes")
        }
        val format = formatOf(bytes) ?: throw unsupported()
        val orientation = if (format == "jpeg") Exif.orientationOf(bytes) else Exif.UPRIGHT
        return encode(upright(scaled(centreSquare(bytes, format)), orientation))
    }

    /** The ImageIO format of a JPG, PNG or WebP, from its signature; `null` for anything else. */
    private fun formatOf(bytes: ByteArray): String? =
        when {
            bytes.startsWith(jpeg) -> "jpeg"
            bytes.startsWith(png) -> "png"
            bytes.startsWith(riff) && bytes.startsWith(webp, WEBP_TAG_OFFSET) -> "webp"
            else -> null
        }

    /**
     * The centred square of the image, read subsampled to at most twice [PIXELS] across, so a large photo
     * never sits in memory whole. Decoders throw more than IOException on broken files; any of it means the
     * file isn't readable.
     */
    @Suppress("TooGenericExceptionCaught")
    private fun centreSquare(
        bytes: ByteArray,
        format: String,
    ): BufferedImage {
        val reader = ImageIO.getImageReadersByFormatName(format).next()
        try {
            ImageIO.createImageInputStream(bytes.inputStream()).use { input ->
                reader.input = input
                val width = reader.getWidth(0)
                val height = reader.getHeight(0)
                requireFewEnoughPixels(width, height)
                val side = minOf(width, height)
                val step = maxOf(1, side / (2 * PIXELS))
                val param =
                    reader.defaultReadParam.apply {
                        sourceRegion = Rectangle((width - side) / 2, (height - side) / 2, side, side)
                        setSourceSubsampling(step, step, 0, 0)
                    }
                return reader.read(0, param)
            }
        } catch (e: Exception) {
            throw e as? ProblemException ?: unsupported()
        } finally {
            reader.dispose()
        }
    }

    private fun requireFewEnoughPixels(
        width: Int,
        height: Int,
    ) {
        if (width.toLong() * height > MAX_SOURCE_PIXELS) {
            throw ProblemException(ProblemCode.AVATAR_TOO_LARGE, "$width × $height pixels is too many")
        }
    }

    // Opaque, as JPEG is: a transparent PNG's background becomes white.
    private fun scaled(source: BufferedImage): BufferedImage {
        val target = BufferedImage(PIXELS, PIXELS, BufferedImage.TYPE_INT_RGB)
        val graphics = target.createGraphics()
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC)
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY)
            graphics.drawImage(source, 0, 0, PIXELS, PIXELS, Color.WHITE, null)
        } finally {
            graphics.dispose()
        }
        return target
    }

    /**
     * [square] as it's meant to be seen, by its EXIF [orientation] (1–8). The centred square of a turned
     * picture is the turned centred square, so turning it after cropping is the same.
     */
    @Suppress("MagicNumber", "CyclomaticComplexMethod")
    private fun upright(
        square: BufferedImage,
        orientation: Int,
    ): BufferedImage {
        if (orientation == Exif.UPRIGHT) {
            return square
        }
        val last = PIXELS - 1
        val target = BufferedImage(PIXELS, PIXELS, BufferedImage.TYPE_INT_RGB)
        for (y in 0..last) {
            for (x in 0..last) {
                // Where the pixel shown at x, y is stored.
                val (sourceX, sourceY) =
                    when (orientation) {
                        2 -> last - x to y
                        3 -> last - x to last - y
                        4 -> x to last - y
                        5 -> y to x
                        6 -> y to last - x
                        7 -> last - y to last - x
                        8 -> last - y to x
                        else -> x to y
                    }
                target.setRGB(x, y, square.getRGB(sourceX, sourceY))
            }
        }
        return target
    }

    private fun encode(image: BufferedImage): ByteArray {
        val writer = ImageIO.getImageWritersByFormatName("jpeg").next()
        val out = ByteArrayOutputStream()
        try {
            ImageIO.createImageOutputStream(out).use { output ->
                writer.output = output
                val param =
                    writer.defaultWriteParam.apply {
                        compressionMode = ImageWriteParam.MODE_EXPLICIT
                        compressionQuality = QUALITY
                    }
                writer.write(null, IIOImage(image, null, null), param)
            }
        } catch (e: IOException) {
            throw IllegalStateException("Couldn't encode an Avatar", e)
        } finally {
            writer.dispose()
        }
        return out.toByteArray()
    }

    private fun unsupported() = ProblemException(ProblemCode.AVATAR_TYPE_UNSUPPORTED, "Not a readable JPG, PNG or WebP")

    private fun byteArrayOf(vararg bytes: Int) = ByteArray(bytes.size) { bytes[it].toByte() }

    private fun ByteArray.startsWith(
        prefix: ByteArray,
        offset: Int = 0,
    ) = size >= offset + prefix.size && prefix.indices.all { this[offset + it] == prefix[it] }
}

/** Reads the one EXIF tag an Avatar needs: how a JPEG is meant to be turned to be seen upright. */
private object Exif {
    const val UPRIGHT = 1

    private const val MARKER = 0xFF
    private const val APP1 = 0xE1
    private const val START_OF_SCAN = 0xDA
    private const val ORIENTATION_TAG = 0x0112
    private const val IFD_ENTRY_SIZE = 12
    private val header = "Exif\u0000\u0000".toByteArray(Charsets.US_ASCII)
    private val orientations = 1..8

    /** The Orientation of [jpeg] from its EXIF segment; upright when it has none or it's broken. */
    fun orientationOf(jpeg: ByteArray): Int =
        try {
            exifOffset(jpeg)?.let { orientationIn(ByteBuffer.wrap(jpeg).position(it).slice()) } ?: UPRIGHT
        } catch (_: IndexOutOfBoundsException) {
            UPRIGHT
        }

    /** Where the TIFF data of [jpeg]'s EXIF segment starts, walking its segments up to the image data. */
    @Suppress("MagicNumber")
    private fun exifOffset(jpeg: ByteArray): Int? {
        val bytes = ByteBuffer.wrap(jpeg)
        var offset = 2
        var found: Int? = null
        while (found == null && offset + 4 <= jpeg.size && bytes.get(offset).toUByte().toInt() == MARKER) {
            val marker = bytes.get(offset + 1).toUByte().toInt()
            val data = offset + 4
            if (marker == START_OF_SCAN) {
                break
            }
            if (marker == APP1 && header.indices.all { jpeg[data + it] == header[it] }) {
                found = data + header.size
            }
            offset += 2 + bytes.getShort(offset + 2).toUShort().toInt()
        }
        return found
    }

    /** The Orientation in the first IFD of the TIFF data [tiff]. */
    @Suppress("MagicNumber")
    private fun orientationIn(tiff: ByteBuffer): Int {
        tiff.order(if (tiff.get(0) == 'I'.code.toByte()) ByteOrder.LITTLE_ENDIAN else ByteOrder.BIG_ENDIAN)
        val ifd = tiff.getInt(4)
        val entries = tiff.getShort(ifd).toUShort().toInt()
        for (entry in 0 until entries) {
            val at = ifd + 2 + entry * IFD_ENTRY_SIZE
            if (tiff.getShort(at).toUShort().toInt() == ORIENTATION_TAG) {
                return tiff.getShort(at + 8).toInt().takeIf { it in orientations } ?: UPRIGHT
            }
        }
        return UPRIGHT
    }
}
