<#import "template.ftl" as layout>
<#--
  A Google login whose email already belongs to a User. "Link" leads to the password re-login
  (login.ftl's linking mode); the realm's first broker login has no email way. Keycloak's
  "Review profile" button (updateProfile) is left out.
-->
<#-- Keycloak's own "user with email ... already exists" message would repeat the copy below. -->
<@layout.registrationLayout displayMessage=false backUrl=url.loginRestartFlowUrl; section>
    <#if section = "header">
        ${msg("confirmLinkIdpTitle")}
    <#elseif section = "form">
        <p class="text-center">
            <#-- The email is bold, so the message's {0} slot gets markup. -->
            <#assign existing = msg("confirmLinkIdpExisting", "@email@")?split("@email@")>
            ${existing[0]}<b>${brokerContext.email!''}</b>${existing[1]}
        </p>
        <p class="text-center text-text-muted">${msg("confirmLinkIdpHint", idpDisplayName)}</p>
        <form id="kc-register-form" class="flex justify-end" action="${url.loginAction}" method="post">
            <button class="button-primary" type="submit" name="submitAction" id="linkAccount" value="linkAccount">${msg("confirmLinkIdpContinue", idpDisplayName)}</button>
        </form>
    </#if>
</@layout.registrationLayout>
