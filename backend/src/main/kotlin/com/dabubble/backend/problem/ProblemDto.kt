package com.dabubble.backend.problem

/** An RFC 9457 problem with the app's [code], and for VALIDATION_FAILED, which [errors] each field has. */
data class ProblemDto(
    val type: String,
    val title: String,
    val status: Int,
    val detail: String?,
    val instance: String?,
    val code: ProblemCode,
    val errors: List<FieldErrorDto>,
)

/** One failed constraint, e.g. `{ field: "name", code: "NOT_BLANK" }`; the code is the constraint name. */
data class FieldErrorDto(
    val field: String,
    val code: String,
)
