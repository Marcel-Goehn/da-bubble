<#import "template.ftl" as layout>
<#--
  "Check your email": shown after sign-up and whenever an unverified User logs in. Resending within
  Keycloak's 30 s cooldown comes back here with the emailVerifySendCooldown message.
-->
<@layout.registrationLayout; section>
    <#if section = "header">
        ${msg("emailVerifyTitle")}
    <#elseif section = "form">
        <p class="text-center">
            <#if verifyEmail??>
                ${msg("emailVerifyInstruction1", verifyEmail)}
            <#else>
                ${msg("emailVerifyInstruction4", user.email)}
            </#if>
        </p>
        <form id="kc-verify-email-form" class="flex flex-col items-center gap-15" action="${url.loginAction}" method="post">
            <#if isAppInitiatedAction?? && !verifyEmail??>
                <button class="button-primary" type="submit">${msg("emailVerifySend")}</button>
            <#else>
                <p class="flex flex-wrap items-center justify-center gap-x-5 text-text-muted">
                    ${msg("emailVerifyInstruction2")}
                    <button class="link-soft cursor-pointer" type="submit">${msg("emailVerifyResend")}</button>
                </p>
            </#if>
            <#if isAppInitiatedAction??>
                <button class="button-secondary" type="submit" name="cancel-aia" value="true" formnovalidate>${msg("doCancel")}</button>
            </#if>
        </form>
    </#if>
</@layout.registrationLayout>
