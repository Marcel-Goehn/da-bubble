<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#--
  Name, email and the privacy checkbox. No password: with verify email on, Keycloak asks for it
  right after this form (UPDATE_PASSWORD, then VERIFY_EMAIL). The checkbox is the Terms and
  conditions registration action; posting "on" records the acceptance, so terms.ftl never shows.
-->
<@layout.registrationLayout displayMessage=messagesPerField.exists('global') backUrl=url.loginUrl; section>
    <#if section = "header">
        ${msg("registerTitle")}
    <#elseif section = "form">
        <p class="text-center">${msg("registerIntro")}</p>
        <form id="kc-register-form" class="flex flex-col gap-20" action="${url.registrationAction}" method="post">
            <@field.input name="firstName" label=msg("fullName") icon="person" autocomplete="name"
                value=(profile.attributesByName.firstName.value)!'' error=messagesPerField.get('firstName')
                rawAttributes='autofocus'/>
            <@field.input name="email" label=msg("email") placeholder=msg("emailPlaceholder") icon="mail" type="email"
                autocomplete="email" value=(profile.attributesByName.email.value)!'' error=messagesPerField.get('email')/>

            <#if termsAcceptanceRequired??>
                <div>
                    <div class="flex items-center gap-10 px-5 text-16 text-text-subtle">
                        <input class="size-20 shrink-0 cursor-pointer accent-accent" type="checkbox" id="termsAccepted" name="termsAccepted" value="on"
                               <#if messagesPerField.existsError('termsAccepted')>aria-invalid="true" aria-describedby="termsAccepted-error"</#if>>
                        <@field.privacyConsentLabel for="termsAccepted"/>
                    </div>
                    <#if messagesPerField.existsError('termsAccepted')>
                        <p class="field-error px-5" id="termsAccepted-error" aria-live="polite">${kcSanitize(messagesPerField.get('termsAccepted'))?no_esc}</p>
                    </#if>
                </div>
            </#if>

            <div class="flex justify-end">
                <button class="button-primary" type="submit">${msg("doNext")}</button>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
