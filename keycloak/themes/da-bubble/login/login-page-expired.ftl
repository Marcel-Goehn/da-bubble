<#import "template.ftl" as layout>
<#-- A login page opened again after Keycloak moved on, e.g. with the browser's back button. -->
<@layout.registrationLayout; section>
    <#if section = "header">
        ${msg("pageExpiredTitle")}
    <#elseif section = "form">
        <div class="flex flex-col items-center gap-15 text-center">
            <p>${msg("pageExpiredMessage")}</p>
            <a id="loginContinueLink" class="button-primary" href="${url.loginAction}">${msg("doContinueLogin")}</a>
            <a id="loginRestartLink" class="link-soft" href="${url.loginRestartFlowUrl}">${msg("doRestartLogin")}</a>
        </div>
    </#if>
</@layout.registrationLayout>
