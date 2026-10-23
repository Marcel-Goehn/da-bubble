package com.dabubble.backend.user

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.web.filter.OncePerRequestFilter
import org.springframework.web.servlet.HandlerExceptionResolver

/** Runs after bearer authentication and resolves the User for every authenticated request. */
class CurrentUserFilter(
    private val currentUsers: CurrentUserService,
    private val exceptionResolver: HandlerExceptionResolver,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val authentication = SecurityContextHolder.getContextHolderStrategy().context.authentication
        if (authentication is JwtAuthenticationToken) {
            // Filters run outside Spring MVC, so failures are handed to ProblemHandler explicitly.
            @Suppress("TooGenericExceptionCaught")
            try {
                request.setAttribute(ATTRIBUTE, currentUsers.resolve(authentication.token))
            } catch (ex: Exception) {
                exceptionResolver.resolveException(request, response, null, ex)
                return
            }
        }
        filterChain.doFilter(request, response)
    }

    companion object {
        val ATTRIBUTE: String = CurrentUserFilter::class.java.name + ".user"
    }
}
