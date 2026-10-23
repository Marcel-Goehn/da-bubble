<#import "template.ftl" as layout>
<#--
  Keycloak's error page, e.g. the original tab of a sign-up whose link was opened in another
  browser, or a login link that is no longer valid. There is no login or authenticationSession
  here, and client is missing when the link names an unknown client, so the way back falls back
  to the app's base URL.
-->
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        ${msg("errorTitle")}
    <#elseif section = "form">
        <div id="kc-error-message" class="flex flex-col items-center gap-30 text-center">
            <p>${kcSanitize(message.summary)?no_esc}</p>
            <#if traceId??>
                <p class="text-16 text-text-muted" id="traceId">${msg("traceIdSupportMessage", traceId)}</p>
            </#if>
            <#if !skipLink??>
                <a id="backToApplication" class="button-primary" href="${(client.baseUrl)?has_content?then(client.baseUrl, properties.appBaseUrl)}">${msg("backToApplication")}</a>
            </#if>
        </div>
    </#if>
</@layout.registrationLayout>
