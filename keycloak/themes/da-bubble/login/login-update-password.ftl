<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#-- Set password after sign-up, and the new password after a reset link (Figma 05, reset password). -->
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('password', 'password-confirm'); section>
    <#if section = "header">
        ${msg("updatePasswordTitle")}
    <#elseif section = "form">
        <form id="kc-passwd-update-form" class="flex flex-col gap-20" action="${url.loginAction}" method="post" onsubmit="login.disabled = true; return true;">
            <@field.input name="password-new" label=msg("passwordNew") type="password" autocomplete="new-password"
                error=messagesPerField.get('password') rawAttributes='autofocus'/>
            <@field.input name="password-confirm" label=msg("passwordConfirm") type="password" autocomplete="new-password"
                error=messagesPerField.get('password-confirm')/>
            <div class="flex flex-wrap justify-end gap-15">
                <#if isAppInitiatedAction??>
                    <button class="button-secondary" type="submit" name="cancel-aia" value="true" formnovalidate>${msg("doCancel")}</button>
                </#if>
                <button class="button-primary" type="submit" name="login">${msg("doSavePassword")}</button>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
