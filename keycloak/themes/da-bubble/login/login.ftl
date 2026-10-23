<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#import "icons.ftl" as icons>
<#--
  The login, in three modes:
  - the normal login (email, password, Gäste-Login, the identity providers, "Konto erstellen");
  - re-auth: a logged-in User asked to log in again (max_age), already known to Keycloak. The
    email is read-only, the password field shows only when the User has a password, and
    social.providers is already limited to the identity providers linked to the User;
  - linking: a Google login whose email already belongs to a User confirms the link with that
    User's password. Keycloak sets nothing to tell this page apart but the first broker login URL.
-->
<#assign linking = url.loginAction?contains("/first-broker-login")>
<#assign reauth = !linking && usernameHidden??>
<#-- authenticatorConfigured only exists once the User is known; otherwise a password is asked for. -->
<#assign hasPassword = !(authenticatorConfigured??) || authenticatorConfigured("auth-password-form")>
<#assign credentialsError = messagesPerField.existsError('username', 'password')>
<#-- The re-auth and linking pages say what to do themselves, so only errors show in the message box. -->
<#assign showMessage = !credentialsError && (!(linking || reauth) || (message?? && message.type = 'error'))>
<#if linking>
    <#assign backUrl = url.loginRestartFlowUrl backLabel = msg("backToLogin")>
<#elseif reauth>
    <#assign backUrl = (client.baseUrl)!'' backLabel = msg("backToApplication")>
<#else>
    <#assign backUrl = '' backLabel = msg("backToLogin")>
</#if>
<@layout.registrationLayout displayMessage=showMessage backUrl=backUrl backLabel=backLabel; section>
    <#if section = "header">
        <#if linking>${msg("linkIdpTitle")}<#elseif reauth>${msg("reauthTitle")}<#else>${msg("loginAccountTitle")}</#if>
    <#elseif section = "form">
        <p class="text-center">
            <#if linking>
                ${msg("linkIdpReauthIntro")}
            <#elseif reauth>
                ${msg(hasPassword?then("reauthPasswordIntro", "reauthProviderIntro"))}
            <#else>
                ${msg("loginIntro")}
            </#if>
        </p>
        <#if realm.password>
            <#assign knownEmail = reauth?then(auth.attemptedUsername!'', (login.username)!'')>
            <#if !hasPassword>
                <@field.input name="username" label=msg("email") icon="mail" value=knownEmail rawAttributes='readonly'/>
            <#else>
                <form id="kc-form-login" class="flex flex-col gap-20" action="${url.loginAction}" method="post" onsubmit="login.disabled = true; return true;">
                    <#if linking || reauth>
                        <@field.input name="username" label=msg("email") icon="mail" value=knownEmail autocomplete="username"
                            rawAttributes='readonly'/>
                        <@field.input name="password" label=msg("password") icon="lock" type="password" autocomplete="current-password"
                            error=credentialsError?then(messagesPerField.getFirstError('username', 'password'), '') rawAttributes='autofocus'/>
                    <#else>
                        <#-- One message for both fields, so a wrong email and a wrong password look the same. -->
                        <@field.input name="username" label=msg("email") placeholder=msg("emailPlaceholder") icon="mail"
                            value=(login.username!'') autocomplete="username"
                            rawAttributes='inputmode="email" autofocus' + credentialsError?then(' aria-invalid="true" aria-describedby="password-error"', '')/>
                        <@field.input name="password" label=msg("password") icon="lock" type="password" autocomplete="current-password"
                            error=credentialsError?then(messagesPerField.getFirstError('username', 'password'), '')/>
                    </#if>
                    <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>>
                    <#if realm.resetPasswordAllowed>
                        <a class="link-soft self-center" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a>
                    </#if>
                    <#if linking || reauth>
                        <div class="flex justify-end">
                            <button class="button-primary" name="login" id="kc-login" type="submit">${msg(linking?then("doLink", "doNext"))}</button>
                        </div>
                    <#else>
                        <div class="flex flex-wrap justify-center gap-20 md:gap-30">
                            <button class="button-primary" name="login" id="kc-login" type="submit">${msg("doLogIn")}</button>
                            <#-- Submits the Guest form below, so the fields above stay empty. -->
                            <button class="button-secondary" id="kc-login-guest" type="submit" form="kc-form-guest">${msg("doGuestLogIn")}</button>
                        </div>
                    </#if>
                </form>
            </#if>
            <#if !(linking || reauth)>
                <#-- The Guest's credentials, posted through the normal login (and so the app's PKCE flow). -->
                <form id="kc-form-guest" class="hidden" action="${url.loginAction}" method="post" onsubmit="document.getElementById('kc-login-guest').disabled = true; return true;">
                    <input type="hidden" name="username" value="guest@dabubble.com">
                    <input type="hidden" name="password" value="${properties.guestPassword}">
                </form>
            </#if>
        </#if>
    <#elseif section = "socialProviders">
        <#-- Disabled identity providers (Google without its secret) aren't in social.providers at all. -->
        <#if realm.password && !linking && social?? && social.providers?has_content>
            <#if hasPassword>
                <div class="flex items-center gap-15 text-text" aria-hidden="true">
                    <span class="h-px flex-1 bg-border"></span>
                    ${msg("loginOr")}
                    <span class="h-px flex-1 bg-border"></span>
                </div>
            </#if>
            <ul class="flex flex-col gap-10" aria-label="${msg("identity-provider-login-label")}">
                <#list social.providers as p>
                    <li>
                        <a id="social-${p.alias}" href="${p.loginUrl}"
                           class="flex w-full items-center justify-center gap-15 rounded-full border border-transparent bg-field px-32 py-18 text-18 text-accent hover:border-accent active:border-text-muted">
                            <#if p.alias = "google"><@icons.google/></#if>
                            ${msg(reauth?then("continueWithProvider", "loginWithProvider"), p.displayName!p.alias)}
                        </a>
                    </li>
                </#list>
            </ul>
        </#if>
    <#elseif section = "register">
        <#if realm.password && realm.registrationAllowed && !registrationDisabled?? && !(linking || reauth)>
            <span>${msg("noAccount")}</span>
            <a class="link-soft" href="${url.registrationUrl}">${msg("doRegister")}</a>
        </#if>
    </#if>
</@layout.registrationLayout>
