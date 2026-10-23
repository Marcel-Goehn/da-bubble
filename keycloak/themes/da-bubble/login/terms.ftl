<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#--
  The TERMS_AND_CONDITIONS required action. Sign-ups through the form accept it with the register
  checkbox, so in practice only Google sign-ups see this page. Rendered as a plain form page: there
  is no login or authenticationSession, but user is the raw UserModel. Keycloak records the
  acceptance on any post without "cancel", so the checkbox only gates the submit in the browser.
-->
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        ${msg("termsTitle")}
    <#elseif section = "form">
        <p class="text-center">
            <#if (user.firstName)?has_content>${msg("termsGreeting", user.firstName)}<#else>${msg("termsGreetingNoName")}</#if>
        </p>
        <form id="kc-terms-form" class="flex flex-col gap-20" action="${url.loginAction}" method="post">
            <div class="flex items-center justify-center gap-10 px-5 text-16 text-text-subtle">
                <input class="size-20 shrink-0 cursor-pointer accent-accent" type="checkbox" id="termsAccepted" required>
                <@field.privacyConsentLabel for="termsAccepted"/>
            </div>
            <div class="flex justify-end">
                <button class="button-primary" type="submit" name="accept" id="kc-accept">${msg("doNext")}</button>
            </div>
            <button class="link-soft cursor-pointer self-center" type="submit" name="cancel" id="kc-decline" formnovalidate>${msg("doCancel")}</button>
        </form>
    </#if>
</@layout.registrationLayout>
