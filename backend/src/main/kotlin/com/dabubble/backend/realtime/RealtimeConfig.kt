package com.dabubble.backend.realtime

import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Lazy
import org.springframework.messaging.simp.config.ChannelRegistration
import org.springframework.messaging.simp.config.MessageBrokerRegistry
import org.springframework.scheduling.TaskScheduler
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker
import org.springframework.web.socket.config.annotation.StompEndpointRegistry
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration

/**
 * STOMP over WebSocket at `/ws` with Spring's simple broker on this single instance. Clients only listen:
 * every User action is a REST write, so there are no `@MessageMapping` handlers.
 */
@Configuration
@EnableWebSocketMessageBroker
class RealtimeConfig(
    private val authInterceptor: StompAuthInterceptor,
    private val sessions: RealtimeSessions,
    // Lazy: the broker configuration that creates it is the one asking for it.
    @Lazy @Qualifier("messageBrokerTaskScheduler") private val scheduler: TaskScheduler,
) : WebSocketMessageBrokerConfigurer {
    override fun registerStompEndpoints(registry: StompEndpointRegistry) {
        registry.addEndpoint(ENDPOINT)
        registry.setErrorHandler(StompErrorHandler())
    }

    override fun configureMessageBroker(registry: MessageBrokerRegistry) {
        registry
            .enableSimpleBroker("/queue", "/topic")
            .setHeartbeatValue(longArrayOf(HEARTBEAT_MILLIS, HEARTBEAT_MILLIS))
            .setTaskScheduler(scheduler)
    }

    override fun configureWebSocketTransport(registration: WebSocketTransportRegistration) {
        registration.addDecoratorFactory(sessions)
    }

    override fun configureClientInboundChannel(registration: ChannelRegistration) {
        registration.interceptors(authInterceptor)
    }

    companion object {
        const val ENDPOINT = "/ws"
        const val HEARTBEAT_MILLIS = 10_000L
    }
}
