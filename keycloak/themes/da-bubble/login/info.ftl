<#import "template.ftl" as layout>
<#--
  Keycloak's information pages. For this theme the important ones are the verification link opened
  in another browser: "confirm" (with the action link) and then "verified" (with the way back to
  the app).
-->
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        <#if messageHeader??>
            ${kcSanitize(msg("${messageHeader}"))?no_esc}
        <#else>
            ${message.summary}
        </#if>
    <#elseif section = "form">
        <div id="kc-info-message" class="flex flex-col items-center gap-30 text-center">
            <p>${message.summary}<#if requiredActions??><#list requiredActions>: <b><#items as reqActionItem>${kcSanitize(msg("requiredAction.${reqActionItem}"))?no_esc}<#sep>, </#items></b></#list></#if></p>
            <#if !skipLink??>
                <#if pageRedirectUri?has_content>
                    <a class="button-primary" href="${pageRedirectUri}">${msg("backToApplication")}</a>
                <#elseif actionUri?has_content>
                    <a class="button-primary" href="${actionUri}">${msg("proceedWithAction")}</a>
                <#elseif (client.baseUrl)?has_content>
                    <a class="button-primary" href="${client.baseUrl}">${msg("backToApplication")}</a>
                </#if>
            </#if>
        </div>
    </#if>
</@layout.registrationLayout>
