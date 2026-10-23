package com.dabubble.backend.user

import org.springframework.context.annotation.Configuration
import org.springframework.core.MethodParameter
import org.springframework.web.bind.support.WebDataBinderFactory
import org.springframework.web.context.request.NativeWebRequest
import org.springframework.web.context.request.RequestAttributes
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.method.support.ModelAndViewContainer
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

/** Hands controllers the User that [CurrentUserFilter] resolved, so they never read the JWT. */
class CurrentUserArgumentResolver : HandlerMethodArgumentResolver {
    override fun supportsParameter(parameter: MethodParameter): Boolean = parameter.parameterType == User::class.java

    override fun resolveArgument(
        parameter: MethodParameter,
        mavContainer: ModelAndViewContainer?,
        webRequest: NativeWebRequest,
        binderFactory: WebDataBinderFactory?,
    ): User =
        checkNotNull(webRequest.getAttribute(CurrentUserFilter.ATTRIBUTE, RequestAttributes.SCOPE_REQUEST) as User?) {
            "No current User; is the endpoint authenticated?"
        }
}

@Configuration
class CurrentUserWebConfig : WebMvcConfigurer {
    override fun addArgumentResolvers(resolvers: MutableList<HandlerMethodArgumentResolver>) {
        resolvers += CurrentUserArgumentResolver()
    }
}
