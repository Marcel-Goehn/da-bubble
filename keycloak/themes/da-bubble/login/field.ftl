<#import "icons.ftl" as icons>
<#--
  A login input (Figma 2.–6.). As in the Figma, only the placeholder is visible (the label unless
  given), so the real label is for screen readers only. Errors sit below the field.
  rawAttributes is spliced into the <input> unescaped, so it only ever takes literals from templates.
-->
<#macro input name label placeholder="" icon="" type="text" value="" error="" autocomplete="" rawAttributes="">
    <div>
        <label class="sr-only" for="${name}">${label}</label>
        <div class="relative">
            <#if icon?has_content>
                <@icons.icon name=icon class="field-icon"/>
            </#if>
            <input class="field <#if !icon?has_content>pl-32</#if>" id="${name}" name="${name}" type="${type}" value="${value}"
                   placeholder="${placeholder?has_content?then(placeholder, label)}"
                   <#if autocomplete?has_content>autocomplete="${autocomplete}"</#if>
                   <#if error?has_content>aria-invalid="true" aria-describedby="${name}-error"</#if>
                   ${rawAttributes?no_esc}>
        </div>
        <#if error?has_content>
            <p class="field-error" id="${name}-error" aria-live="polite">${kcSanitize(error)?no_esc}</p>
        </#if>
    </div>
</#macro>

<#-- "Ich stimme der Datenschutzerklärung zu." for the checkbox [for], with the policy as a link. -->
<#macro privacyConsentLabel for>
    <#-- privacyConsent has a {0} slot for the link; Keycloak trims the edges of message values. -->
    <#local consent = msg("privacyConsent", "@link@")?split("@link@")>
    <label for="${for}">${consent[0]}<a class="link" href="${properties.appBaseUrl}/datenschutz" target="_blank" rel="noopener">${msg("privacyConsentLink")}</a>${consent[1]}</label>
</#macro>
