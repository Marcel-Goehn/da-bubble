<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#-- "Passwort vergessen" (Figma 04, send email). Also recovers a sign-up abandoned before its password. -->
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username') backUrl=url.loginUrl; section>
    <#if section = "header">
        ${msg("emailForgotTitle")}
    <#elseif section = "form">
        <p class="text-center">${msg("resetPasswordIntro")}</p>
        <form id="kc-reset-password-form" class="flex flex-col gap-20" action="${url.loginAction}" method="post">
            <@field.input name="username" label=msg("email") placeholder=msg("emailPlaceholder") icon="mail" type="email"
                autocomplete="email" value=(auth.attemptedUsername!'') error=messagesPerField.get('username') rawAttributes='autofocus'/>
            <p class="text-center text-text-muted">${msg("emailInstruction")}</p>
            <div class="flex justify-end">
                <button class="button-primary" type="submit">${msg("doSendEmail")}</button>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
