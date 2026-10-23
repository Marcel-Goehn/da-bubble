package com.dabubble.backend.problem

import org.slf4j.LoggerFactory
import org.springframework.context.MessageSourceResolvable
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.MediaType
import org.springframework.http.ProblemDetail
import org.springframework.http.ResponseEntity
import org.springframework.security.core.AuthenticationException
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.context.request.ServletWebRequest
import org.springframework.web.context.request.WebRequest
import org.springframework.web.method.annotation.HandlerMethodValidationException
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler

/**
 * Turns every error into a [ProblemDto]: those of controllers and Spring MVC, and those the security
 * filters hand over through the `HandlerExceptionResolver` (rejected tokens, failures in CurrentUserFilter).
 */
@RestControllerAdvice
class ProblemHandler : ResponseEntityExceptionHandler() {
    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler
    fun handleProblem(
        ex: ProblemException,
        request: WebRequest,
    ): ResponseEntity<Any> = problem(ex.code, ex.code.status, ex.message, emptyList(), HttpHeaders(), request)

    // The status and WWW-Authenticate header are already set by the bearer token entry point.
    @ExceptionHandler(AuthenticationException::class)
    fun handleUnauthenticated(request: WebRequest): ResponseEntity<Any> {
        val code = ProblemCode.UNAUTHENTICATED
        return problem(code, code.status, null, emptyList(), HttpHeaders(), request)
    }

    // Anything unexpected: logged here, and the response says nothing about it.
    @ExceptionHandler
    fun handleUnexpected(
        ex: Exception,
        request: WebRequest,
    ): ResponseEntity<Any> {
        log.error("Unhandled exception", ex)
        val code = ProblemCode.INTERNAL_ERROR
        return problem(code, code.status, null, emptyList(), HttpHeaders(), request)
    }

    override fun handleExceptionInternal(
        ex: Exception,
        body: Any?,
        headers: HttpHeaders,
        statusCode: HttpStatusCode,
        request: WebRequest,
    ): ResponseEntity<Any> {
        val errors = fieldErrors(ex)
        val code = if (errors.isEmpty()) ProblemCode.forStatus(statusCode.value()) else ProblemCode.VALIDATION_FAILED
        return problem(code, statusCode, (body as? ProblemDetail)?.detail, errors, headers, request)
    }

    private fun fieldErrors(ex: Exception): List<FieldErrorDto> =
        when (ex) {
            is MethodArgumentNotValidException -> {
                ex.bindingResult.fieldErrors.map { FieldErrorDto(it.field, constraintCode(it)) }
            }

            is HandlerMethodValidationException -> {
                ex.parameterValidationResults.flatMap { result ->
                    result.resolvableErrors.map { error ->
                        val field = (error as? FieldError)?.field ?: result.methodParameter.parameterName.orEmpty()
                        FieldErrorDto(field, constraintCode(error))
                    }
                }
            }

            else -> {
                emptyList()
            }
        }

    private fun problem(
        code: ProblemCode,
        status: HttpStatusCode,
        detail: String?,
        errors: List<FieldErrorDto>,
        headers: HttpHeaders,
        request: WebRequest,
    ): ResponseEntity<Any> {
        val body =
            ProblemDto(
                type = "about:blank",
                title = HttpStatus.resolve(status.value())?.reasonPhrase ?: status.toString(),
                status = status.value(),
                detail = detail,
                instance = (request as? ServletWebRequest)?.request?.requestURI,
                code = code,
                errors = errors,
            )
        return ResponseEntity
            .status(status)
            .headers(headers)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .body(body)
    }
}

// The constraint's simple name, the last of its message codes: "NotBlank" becomes "NOT_BLANK".
private fun constraintCode(error: MessageSourceResolvable): String =
    error.codes
        ?.lastOrNull()
        .orEmpty()
        .replace(Regex("([a-z0-9])([A-Z])"), "$1_$2")
        .uppercase()
