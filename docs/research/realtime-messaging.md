# Research: authenticated real-time messaging (Spring Boot 4.1 + Angular 22)

Ticket: [#8](https://github.com/Marcel-Goehn/da-bubble/issues/8) · Map: [#1](https://github.com/Marcel-Goehn/da-bubble/issues/1) · Researched 2026-10-20

**Question.** What are the options for pushing chat events from Spring Boot 4.1 (webmvc + websocket starter, OAuth2 resource server) to an Angular 22 client: STOMP over WebSocket with the simple broker, raw WebSocket, Server-Sent Events? For each: how the JWT authenticates the connection, token expiry on long-lived connections, per-user/per-channel delivery, reconnect behaviour, and Angular client libraries. Scale: a small team on one instance.

This is research only. The transport decision is made later with the human, once the Figma feature inventory exists.

## Versions in play

- `backend/build.gradle.kts`: Spring Boot 4.1.1 with `spring-boot-starter-webmvc`, `-websocket`, `-security`, `-security-oauth2-resource-server`.
- Spring Boot 4.1.1 requires **Spring Framework 7.0.9+** ([Boot system requirements](https://docs.spring.io/spring-boot/system-requirements.html)). The current Spring Security reference is **7.1.1**.
- `frontend/package.json`: Angular ^22.2, rxjs ~7.8. There is no real-time client library yet.
- Auth (map #1 Notes): Angular runs Authorization Code + PKCE against Keycloak and holds the access token in memory. The backend only validates JWTs. **No cookies or server-side HTTP session carry auth.** That one fact shapes everything below.

## The browser constraint that drives everything

- The browser `WebSocket` constructor takes only `url` and `protocols`. Page script cannot set an `Authorization` header on the handshake. Cookies are sent ([WHATWG WebSockets](https://websockets.spec.whatwg.org/)).
- The browser `EventSource` takes only `url` and `{ withCredentials }`. It has no header option ([WHATWG HTML §9.2 SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)).
- The Spring Framework docs draw the same conclusion. Browser clients "can only use standard authentication headers (basic HTTP auth) or cookies and cannot send custom headers". Putting tokens in query parameters risks them being logged ([Spring Framework: Token Authentication](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/authentication-token-based.html)).
- Spring Security's `DefaultBearerTokenResolver.setAllowUriQueryParameter` defaults to `false`. The Javadoc notes that RFC 6750 "recommends against using this mechanism… only included for completeness" ([Javadoc](https://docs.spring.io/spring-security/reference/api/java/org/springframework/security/oauth2/server/resource/web/DefaultBearerTokenResolver.html)).

So with a bearer token held in Angular memory, there are three ways to authenticate a push connection:
1. **In-protocol.** Send the token in the first message after the socket opens, such as the STOMP CONNECT frame.
2. **Query parameter on the handshake.** This is discouraged, and the token leaks into access logs.
3. **A fetch-based client that can set headers.** This works for SSE only, not for WebSocket.

## Option A: STOMP over WebSocket with the simple broker

**Server.** `@EnableWebSocketMessageBroker` with `enableSimpleBroker("/topic", "/queue")`. The simple broker keeps subscriptions in memory and supports Ant-style destination patterns ([Simple Broker](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/handle-simple-broker.html)). In-memory state is fine on one instance.

**JWT authentication: the CONNECT frame, not the handshake.**
- By default Spring takes the Principal from the HTTP handshake (`HttpServletRequest#getUserPrincipal()`) and ignores STOMP `login`/`passcode` headers ([STOMP Authentication](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/authentication.html)). We have no cookie session, so the handshake is anonymous.
- The documented alternative is token auth on CONNECT. Register a `ChannelInterceptor` on the client inbound channel. In it, read the header from the `CONNECT` frame and call `accessor.setUser(user)`. "Spring then saves and uses the authenticated user for subsequent STOMP messages on the same session." When Spring Security message authorization is also used, this interceptor must be ordered ahead of it with `@Order(Ordered.HIGHEST_PRECEDENCE + 99)` ([Token Authentication](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/authentication-token-based.html)). Inside the interceptor, the existing resource-server `JwtDecoder` and JWT-to-Authentication converter can be reused to validate the token. That is our wiring, not something the docs show.
- The `/ws` handshake endpoint must therefore be `permitAll` in the HTTP security chain. All enforcement happens at the message level.

**Authorization (Spring Security 7.1.1)** ([WebSocket Security](https://docs.spring.io/spring-security/reference/servlet/integrations/websocket.html)):
- `@EnableWebSocketSecurity` plus an `AuthorizationManager<Message<?>>` bean built with `simpDestMatchers`, `simpSubscribeDestMatchers`, `nullDestMatcher`, `simpTypeMatchers` and `anyMessage().denyAll()`. The legacy `AbstractSecurityWebSocketMessageBrokerConfigurer` was **removed** in Security 7.
- **Only the inbound channel is secured.** Outbound messages are not checked, so the docs advise securing subscriptions. For per-channel chat this means a custom `AuthorizationManager` that checks channel membership on `SUBSCRIBE /topic/channel.{id}`. Static matchers cannot express membership.
- **CSRF caveat:** `@EnableWebSocketSecurity` requires a CSRF token on every inbound CONNECT by default, and this is "not configurable" with the annotation yet. With bearer tokens on CONNECT, CSRF is not the threat (no ambient credentials). To turn it off, you must either use the XML `same-origin-disabled="true"` or wire `SecurityContextChannelInterceptor` and `AuthorizationChannelInterceptor` yourself, without the annotation. The docs show both. Spring's own allowed-origins check still applies.

**Per-user and per-channel delivery.**
- Per channel: the server publishes with `SimpMessagingTemplate.convertAndSend("/topic/channel.42", evt)`. Clients subscribe, gated by the membership check above.
- Per user: `convertAndSendToUser(name, "/queue/x", payload)` or `@SendToUser`. Clients subscribe to `/user/queue/x`. `UserDestinationMessageHandler` rewrites that to a session-unique destination. By default delivery goes to **all of the user's sessions** (multiple tabs), and `broadcast=false` targets only the originating session ([User Destinations](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/user-destination.html)). The "name" is the Principal name, so set it to the Keycloak `sub` (our User PK).

**Token expiry.** Auth happens once, at CONNECT. After that the user is fixed for the session ([Token Authentication](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/authentication-token-based.html)). Nothing in Spring re-checks `exp` on a live session (inference from the docs; no re-validation hook is documented). Choices:
- (a) Accept it. A session outlives its token, but each new connection needs a valid token, and REST calls still check expiry.
- (b) Store `exp` in session attributes and close the session server-side when it passes. The client reconnects with a refreshed token.
- (c) Have the client deliberately reconnect after each token refresh.
Option (b) or (c) is cheap with stompjs (below).

**Reconnect and heartbeats.**
- Server heartbeats need a `TaskScheduler` on the simple broker (`setHeartbeatValue`, `setTaskScheduler`) ([Simple Broker](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/handle-simple-broker.html)).
- Client: `@stomp/stompjs` reconnects automatically. `reconnectDelay` defaults to 5000 ms, `reconnectTimeMode` can be `LINEAR` or `EXPONENTIAL` (capped by `maxReconnectDelay`), and `heartbeatIncoming` and `heartbeatOutgoing` default to 10000 ms. **`beforeConnect` (async) runs before every connect and reconnect attempt, and `connectHeaders` are read after it.** Fetching a fresh Keycloak token there gives each reconnect a valid JWT ([stompjs client.ts](https://github.com/stomp-js/stompjs/blob/develop/src/client.ts)).
- Messages sent while disconnected are lost. The client must refetch history over REST after a reconnect. This is true of every option here.

**Angular client libraries.**
- [`@stomp/stompjs`](https://github.com/stomp-js/stompjs) 7.5.0 (released 2026-10-15, Apache-2.0, TypeScript types included).
- [`@stomp/rx-stomp`](https://github.com/stomp-js/rx-stomp) 2.4.0 (2026-05-01). It wraps stompjs as RxJS Observables. Its peer dependencies are stompjs ^7.2, rxjs ^7.2 and uuid. `watch(dest)` returns an Observable that **resubscribes automatically after reconnects**. `RxStompConfig.beforeConnect` is supported. The [Angular guide](https://stomp-js.github.io/guide/rx-stomp/rx-stomp-with-angular.html) wraps it in an `@Injectable({providedIn:'root'})` service. The guide was written for Angular 13, but the pattern is framework-agnostic and maps cleanly to signals or `toSignal`.
- `@stomp/ng2-stompjs` is **deprecated** on npm. Do not use it.

**Trade-offs.** This option comes with the most built in: pub/sub, user destinations, multi-tab, heartbeats, mature reconnect and an Angular-friendly RxJS client. Client to server messages (typing indicators, sending a message) can use the same socket via `@MessageMapping`. The cost is learning STOMP concepts plus a few security-config wrinkles: the CONNECT interceptor, interceptor ordering, the CSRF workaround and a custom subscription authorization manager. The simple broker is single-instance only, which is fine here.

## Option B: raw WebSocket (`@EnableWebSocket` + `TextWebSocketHandler`)

**Server.** Register a `WebSocketHandler` via `WebSocketConfigurer`. A `HandshakeInterceptor` can veto the handshake or copy attributes into the session. Origin checks default to same-origin. Sends on a session must be synchronized, for example with `ConcurrentWebSocketSessionDecorator` ([WebSocket API](https://docs.spring.io/spring-framework/reference/web/websocket/server.html)).

**JWT authentication.** There are two options:
- A `?access_token=` query parameter checked in a `HandshakeInterceptor`. This is discouraged (see above).
- A custom "first message must be `{type:'auth', token}`" protocol. Here we write the state machine ourselves: drop unauthenticated sockets after a timeout, ignore traffic before auth.

The `Sec-WebSocket-Protocol` header is the only other header script can set, and smuggling a token through it is a hack.

**Delivery.** We build our own maps: user → sessions and channel → sessions. We also build our own message envelope and routing, our own subscribe/unsubscribe protocol, and our own membership checks. Spring Security's message authorization does not apply, because it is built for STOMP/`simp` messages.

**Expiry and reconnect.** Same expiry problem as STOMP. No heartbeats are built in (WebSocket ping/pong is not exposed to browser JS), so we add app-level pings. The browser `WebSocket` does not reconnect, so we write backoff and resubscribe logic ourselves, or use a generic wrapper. RxJS's `webSocket()` subject is available in the already-installed `rxjs` and needs no extra dependency, but it has no auto-reconnect (you compose `retry` with a delay).

**Trade-offs.** No extra protocol, smallest wire format, full control. But this is effectively a re-implementation of what STOMP plus the simple broker already provides, with more security surface for us to get right.

## Option C: Server-Sent Events (`SseEmitter` on Spring MVC)

**Server.** Return an `SseEmitter` from a `@GetMapping(produces = TEXT_EVENT_STREAM)` and keep a registry of emitters. Async timeouts default to the servlet container's unless set (on the emitter, or via `configureAsyncSupport`). **The Servlet API gives no disconnect notification**: you only find out when a write fails, so send periodic comment-only heartbeat events. The docs themselves point to WebSocket messaging when built-in heartbeats are needed ([Async Requests / SSE](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html)).

**JWT authentication.** This is the only option where the **normal resource-server filter chain authenticates the connection**, but only if the client can send `Authorization`. Native `EventSource` cannot. The choices:
- A fetch/HttpClient-based client. [`ngx-sse-client`](https://github.com/marcospds/ngx-sse-client) 21.0.0 (2026-03-31, peer `@angular/core >=21`) streams over Angular `HttpClient`, so **`HttpInterceptor`s apply** and can attach the bearer token. It supports GET or POST, `keepAlive` reconnect and `reconnectionDelay` (default 3 s). `@microsoft/fetch-event-source` is an alternative, but its last release was 2.0.1 in April 2021.
- A query-parameter token. This is discouraged.

**Expiry.** The JWT is validated once, when the stream request starts. An open stream outlives `exp` the same way a socket does (inference). The fix is again server-side close at `exp`, or a client reconnect after refresh. With an `HttpClient`-based client, the interceptor supplies the fresh token on each reconnect.

**Delivery.** Our own registry: user → emitters, filter by channel membership on the server. It is one-way, so typing indicators and sends go over normal REST POSTs. Per-user is natural (one stream per tab). Per-channel fan-out is our own loop.

**Reconnect.** Native `EventSource` auto-reconnects. It honours the `retry:` field, sends `Last-Event-ID` on reconnect (usable to replay missed events) and does not retry on a non-200 response ([WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)). Fetch-based clients implement their own reconnect, and `Last-Event-ID` replay is up to us. The spec warns about **per-server connection limits** when several tabs each hold an `EventSource`. This bites on HTTP/1.1 (about 6 connections per host), not HTTP/2.

**Trade-offs.**
- Pros: the simplest server model; the standard bearer-token filter chain applies unchanged; plain HTTP, easy to test; and all writes stay REST.
- Cons: one-way; heartbeat and disconnect detection are hand-rolled; each open stream holds an async request on the servlet container; the multi-tab connection limit applies on HTTP/1.1; and the Angular SSE library choice is thin (one small, single-maintainer package).

## Comparison

| | STOMP + simple broker | Raw WebSocket | SSE (`SseEmitter`) |
|---|---|---|---|
| JWT carried in | STOMP `CONNECT` header (documented) | query param or custom first message | `Authorization` header via HttpClient-based client, or query param |
| Who validates | our `ChannelInterceptor` (reuse `JwtDecoder`) | our `HandshakeInterceptor` / handler | standard resource-server filter chain |
| Token expiry | not re-checked; close at `exp` or reconnect on refresh | same | same |
| Authorization | Spring Security message matchers + custom subscribe check | all hand-written | per-request + hand-written fan-out filter |
| Per-user / multi-tab | built in (`/user/queue`, all sessions) | hand-written | one stream per tab, hand-written registry |
| Per-channel | `/topic/channel.{id}` built in | hand-written | hand-written |
| Client to server | same socket (`@MessageMapping`) | same socket | REST |
| Heartbeat / dead peer | built in (needs `TaskScheduler`) | hand-written | comment events, write-failure detection |
| Reconnect | stompjs auto, `beforeConnect` refreshes token, rx-stomp resubscribes | hand-written | EventSource auto / library `keepAlive` |
| Angular lib | `@stomp/rx-stomp` 2.4.0 (active) | `rxjs/webSocket` (built in) | `ngx-sse-client` 21.0.0 |
| Extra deps | 2 npm (`@stomp/stompjs`, `@stomp/rx-stomp`) | none | 1 npm |

## Leaning (for the later decision)

For a small team on one instance, with a chat app that likely pushes messages, reactions, typing and presence (to be confirmed by the Figma inventory), **STOMP over WebSocket with the simple broker, authenticated via the JWT in the CONNECT frame, with `@stomp/rx-stomp` on Angular** looks best. It is the documented Spring path for browser token auth. It gives user and channel destinations, multi-tab, heartbeats and token-refreshing reconnect for free, and the simple broker's single-instance limit doesn't matter here.

Known work items if chosen:
- the CONNECT interceptor and its ordering
- disabling CONNECT CSRF without `@EnableWebSocketSecurity`
- a membership-aware SUBSCRIBE authorization manager
- an expiry policy (close at `exp`)
- REST refetch after reconnect

**SSE** is the credible simpler alternative if the inventory shows push is only server to client and low-volume. Its main win is reusing the existing bearer-token filter chain unchanged. **Raw WebSocket** has no advantage at this scale.

## Open questions for the decision session

- Which events does the Figma need pushed (messages, edits/deletes, reactions, thread replies, typing, presence, unread counts)? Typing and presence favour a bidirectional socket.
- Expiry policy: close at `exp` (stricter) or tolerate stale sessions until disconnect (simpler)?
- Will the dev setup run behind HTTP/2? This only matters for SSE multi-tab limits.
