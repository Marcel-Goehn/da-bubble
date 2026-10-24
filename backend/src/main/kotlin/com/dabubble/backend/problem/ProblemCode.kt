package com.dabubble.backend.problem

import org.springframework.http.HttpStatus

/**
 * The `code` of every error response. Published in the OpenAPI spec so the frontend maps each one to
 * translated copy; it never shows the server's text.
 */
enum class ProblemCode(
    val status: HttpStatus,
) {
    BAD_REQUEST(HttpStatus.BAD_REQUEST),
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
    MESSAGE_EMPTY(HttpStatus.BAD_REQUEST),
    REPLY_HAS_NO_THREAD(HttpStatus.BAD_REQUEST),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED),
    NOT_MESSAGE_AUTHOR(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    CONFLICT(HttpStatus.CONFLICT),
    MESSAGE_DELETED(HttpStatus.CONFLICT),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR),
    ;

    companion object {
        /** The code for a failure Spring raised itself, which only knows its status. */
        fun forStatus(status: Int): ProblemCode =
            when {
                status == HttpStatus.UNAUTHORIZED.value() -> UNAUTHENTICATED
                status == HttpStatus.NOT_FOUND.value() -> NOT_FOUND
                status == HttpStatus.CONFLICT.value() -> CONFLICT
                status < HttpStatus.INTERNAL_SERVER_ERROR.value() -> BAD_REQUEST
                else -> INTERNAL_ERROR
            }
    }
}

/** Thrown anywhere in a request to answer with [code]'s status and a [ProblemDto]. */
class ProblemException(
    val code: ProblemCode,
    detail: String? = null,
) : RuntimeException(detail)
