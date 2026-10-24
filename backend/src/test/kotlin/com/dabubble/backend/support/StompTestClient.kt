package com.dabubble.backend.support

import com.dabubble.backend.realtime.RealtimeConfig
import com.dabubble.backend.realtime.RealtimeEvent
import com.nimbusds.jwt.SignedJWT
import org.awaitility.Awaitility.await
import org.springframework.messaging.converter.JacksonJsonMessageConverter
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.messaging.simp.stomp.StompSession
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter
import org.springframework.messaging.simp.user.SimpUserRegistry
import org.springframework.web.socket.WebSocketHttpHeaders
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.messaging.WebSocketStompClient
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import java.lang.reflect.Type
import java.time.Duration
import java.util.concurrent.CompletableFuture
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.test.fail

/** Connects to the app's `/ws` endpoint the way the frontend does: a bearer token in the CONNECT frame. */
class StompTestClient(
    private val port: Int,
    private val userRegistry: SimpUserRegistry,
) {
    private val client =
        WebSocketStompClient(StandardWebSocketClient()).apply {
            messageConverter =
                JacksonJsonMessageConverter(JsonMapper.builder().addModule(KotlinModule.Builder().build()).build())
        }
    private val open = mutableListOf<StompTestSession>()

    /** A connected session subscribed to the User's event queue, as every tab of the app is. */
    fun connect(token: String): StompTestSession {
        val session = start(token, SignedJWT.parse(token).jwtClaimsSet.subject)
        session.awaitConnected()
        open += session
        return session
    }

    /** The ERROR frame's message for a CONNECT the server refuses. */
    fun connectRefused(token: String): String = start(token, userId = null).awaitError()

    private fun start(
        token: String,
        userId: String?,
    ): StompTestSession {
        val session = StompTestSession(userRegistry, userId)
        val headers = StompHeaders().apply { add(AUTHORIZATION, "Bearer $token") }
        val url = "ws://localhost:$port${RealtimeConfig.ENDPOINT}"
        client.connectAsync(url, WebSocketHttpHeaders(), headers, session.handler)
        return session
    }

    fun disconnectAll() {
        open.forEach(StompTestSession::disconnect)
        open.clear()
    }

    private companion object {
        const val AUTHORIZATION = "Authorization"
    }
}

class StompTestSession(
    private val userRegistry: SimpUserRegistry,
    private val userId: String?,
) {
    private val connected = CompletableFuture<StompSession>()
    private val error = CompletableFuture<String>()
    private val closed = CompletableFuture<Unit>()
    private val events = LinkedBlockingQueue<RealtimeEvent>()

    internal val handler =
        object : StompSessionHandlerAdapter() {
            override fun afterConnected(
                session: StompSession,
                connectedHeaders: StompHeaders,
            ) {
                connected.complete(session)
            }

            override fun getPayloadType(headers: StompHeaders): Type = RealtimeEvent::class.java

            override fun handleFrame(
                headers: StompHeaders,
                payload: Any?,
            ) {
                // Only ERROR frames reach the session handler; MESSAGE frames go to the subscription.
                error.complete(headers.getFirst("message").orEmpty())
            }

            override fun handleException(
                session: StompSession,
                command: StompCommand?,
                headers: StompHeaders,
                payload: ByteArray,
                exception: Throwable,
            ) {
                fail("Couldn't read a frame", exception)
            }

            override fun handleTransportError(
                session: StompSession,
                exception: Throwable,
            ) {
                connected.completeExceptionally(exception)
                closed.complete(Unit)
            }
        }

    internal fun awaitConnected() {
        val session = connected.get(TIMEOUT.seconds, TimeUnit.SECONDS)
        val before = subscribedCount()
        subscribe(session, EVENTS)
        await().atMost(TIMEOUT).until { subscribedCount() > before }
    }

    internal fun awaitError(): String = error.get(TIMEOUT.seconds, TimeUnit.SECONDS)

    /** Subscribes to [destination] and returns the message of the ERROR frame the server answers with. */
    fun subscribeRefused(destination: String): String {
        val session = connected.get(TIMEOUT.seconds, TimeUnit.SECONDS)
        session.subscribe(destination, handler)
        return awaitError()
    }

    /** The next event pushed to this session; fails if none arrives in time. */
    fun awaitEvent(): RealtimeEvent = events.poll(TIMEOUT.seconds, TimeUnit.SECONDS) ?: fail("No event arrived")

    /** Waits until the server closes the connection; fails if it stays open. */
    fun awaitClosed() {
        closed.get(TIMEOUT.seconds, TimeUnit.SECONDS)
    }

    internal fun disconnect() {
        connected.getNow(null)?.takeIf { it.isConnected }?.disconnect()
    }

    private fun subscribe(
        session: StompSession,
        destination: String,
    ) {
        session.subscribe(
            destination,
            object : StompSessionHandlerAdapter() {
                override fun getPayloadType(headers: StompHeaders): Type = RealtimeEvent::class.java

                override fun handleFrame(
                    headers: StompHeaders,
                    payload: Any?,
                ) {
                    events += payload as RealtimeEvent
                }
            },
        )
    }

    // The simple broker sends no RECEIPT for a SUBSCRIBE, so wait until the server has registered it: a
    // write sent earlier would push its event before anyone listens. The client's session id isn't the
    // server's, so the new subscription is told apart by the count of the User's subscriptions.
    private fun subscribedCount(): Int =
        userRegistry
            .findSubscriptions { it.session.user.name == userId && it.destination == EVENTS }
            .size

    private companion object {
        const val EVENTS = "/user/queue/events"
        val TIMEOUT: Duration = Duration.ofSeconds(5)
    }
}
