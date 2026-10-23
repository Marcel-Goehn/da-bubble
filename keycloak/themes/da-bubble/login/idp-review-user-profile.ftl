<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#--
  First broker login's Review Profile: only shows when the Google data fails the user profile,
  in practice a missing or too long name. Name as on the sign-up form; the email stays read-only
  unless it is the field that failed.
-->
<@layout.registrationLayout displayMessage=messagesPerField.exists('global'); section>
    <#if section = "header">
        ${msg("loginIdpReviewProfileTitle")}
    <#elseif section = "form">
        <p class="text-center">${msg("reviewProfileIntro")}</p>
        <form id="kc-idp-review-profile-form" class="flex flex-col gap-20" action="${url.loginAction}" method="post">
            <@field.input name="firstName" label=msg("fullName") icon="person" autocomplete="name"
                value=(profile.attributesByName.firstName.value)!'' error=messagesPerField.get('firstName')
                rawAttributes='autofocus'/>
            <#assign email = (profile.attributesByName.email.value)!''>
            <@field.input name="email" label=msg("email") placeholder=msg("emailPlaceholder") icon="mail" type="email"
                autocomplete="email" value=email error=messagesPerField.get('email')
                rawAttributes=(email?has_content && !messagesPerField.existsError('email'))?then('readonly', '')/>
            <div class="flex justify-end">
                <button class="button-primary" type="submit">${msg("doNext")}</button>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
