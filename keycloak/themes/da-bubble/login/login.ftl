<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#assign credentialsError = messagesPerField.existsError('username', 'password')>
<@layout.registrationLayout displayMessage=!credentialsError; section>
    <#if section = "header">
        ${msg("loginAccountTitle")}
    <#elseif section = "form">
        <p class="text-center">${msg("loginIntro")}</p>
        <#if realm.password>
            <form id="kc-form-login" class="flex flex-col gap-20" action="${url.loginAction}" method="post" onsubmit="login.disabled = true; return true;">
                <#-- One message for both fields, so a wrong email and a wrong password look the same. -->
                <@field.input name="username" label=msg("email") placeholder=msg("emailPlaceholder") icon="mail"
                    value=(login.username!'') autocomplete="username"
                    rawAttributes='inputmode="email" autofocus' + credentialsError?then(' aria-invalid="true" aria-describedby="password-error"', '')/>
                <@field.input name="password" label=msg("password") icon="lock" type="password" autocomplete="current-password"
                    error=credentialsError?then(messagesPerField.getFirstError('username', 'password'), '')/>
                <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>>
                <#if realm.resetPasswordAllowed>
                    <a class="link-soft self-center" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a>
                </#if>
                <div class="flex justify-center">
                    <button class="button-primary" name="login" id="kc-login" type="submit">${msg("doLogIn")}</button>
                </div>
            </form>
        </#if>
    <#elseif section = "socialProviders">
        <#if realm.password && social?? && social.providers?has_content>
            <div class="flex items-center gap-15 text-text" aria-hidden="true">
                <span class="h-px flex-1 bg-border"></span>
                ${msg("loginOr")}
                <span class="h-px flex-1 bg-border"></span>
            </div>
            <ul class="flex flex-col gap-10" aria-label="${msg("identity-provider-login-label")}">
                <#list social.providers as p>
                    <li>
                        <a id="social-${p.alias}" href="${p.loginUrl}"
                           class="flex w-full items-center justify-center gap-15 rounded-full border border-transparent bg-field px-32 py-18 text-18 text-accent hover:border-accent active:border-text-muted">
                            ${msg("loginWithProvider", p.displayName!p.alias)}
                        </a>
                    </li>
                </#list>
            </ul>
        </#if>
    <#elseif section = "register">
        <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
            <span>${msg("noAccount")}</span>
            <a class="link-soft" href="${url.registrationUrl}">${msg("doRegister")}</a>
        </#if>
    </#if>
</@layout.registrationLayout>
