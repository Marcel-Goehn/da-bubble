<#import "icons.ftl" as icons>
<#--
  The one layout every page of the theme renders through ("variant A"): logo, the Figma card with
  one primary button and the other exits as text links, then the legal links and the language
  switcher. Keeps base's macro name and sections (header, form, socialProviders, info), so pages
  this theme doesn't override still render inside the card.

  Extra parameters and sections:
  - backUrl: shows the Figma's back arrow in front of the title; backLabel names where it goes
    (default: back to the login).
  - section "register": the "Neu bei DABubble?" exit, top right on desktop, below the card on mobile.
-->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false backUrl="" backLabel=msg("backToLogin")>
<#assign pageTitle><#nested "header"></#assign>
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <#-- pageTitle is already escaped markup. -->
    <title>${pageTitle?markup_string?trim?no_esc} · DABubble</title>
    <link rel="icon" type="image/svg+xml" href="${url.resourcesPath}/img/logo-mark.svg">
    <#list properties.styles?split(' ') as style>
        <link href="${url.resourcesPath}/${style}" rel="stylesheet">
    </#list>
    <#-- Kept from base: reloads the page when the login finishes in another tab. -->
    <script type="module">
        <#outputformat "JavaScript">
        import { startSessionPolling } from ${(url.resourcesPath + "/js/authChecker.js")?c};

        startSessionPolling(
            ${url.ssoLoginInOtherTabsUrl?c}
        );
        </#outputformat>
    </script>
    <#if authenticationSession??>
        <script type="module">
            <#outputformat "JavaScript">
            import { checkAuthSession } from ${(url.resourcesPath + "/js/authChecker.js")?c};

            checkAuthSession(
                ${authenticationSession.authSessionIdHash?c}
            );
            </#outputformat>
        </script>
    </#if>
</head>

<body class="${bodyClass}" data-page-id="login-${pageId}">
<div class="flex min-h-dvh flex-col">
    <header class="flex items-start justify-center px-16 pt-40 md:justify-between md:px-75 md:pt-75">
        <div class="flex items-center gap-15">
            <img class="size-56 md:size-70" src="${url.resourcesPath}/img/logo-mark.svg" alt="">
            <span class="text-32 font-bold">DABubble</span>
        </div>
        <div class="hidden flex-col items-end gap-10 md:flex">
            <#nested "register">
        </div>
    </header>

    <main class="flex flex-1 flex-col items-center justify-center gap-30 px-16 py-30">
        <section class="w-full max-w-606 rounded-30 bg-surface px-20 py-30 md:px-50 md:py-40" aria-labelledby="kc-page-title">
            <div class="flex items-center gap-10">
                <#if backUrl?has_content>
                    <a class="flex size-40 shrink-0 items-center justify-center rounded-full hover:bg-hover" href="${backUrl}" aria-label="${backLabel}">
                        <@icons.icon name="arrow_back"/>
                    </a>
                </#if>
                <h1 id="kc-page-title" class="flex-1 text-center text-32 font-bold text-accent md:text-46">${pageTitle?no_esc}</h1>
                <#if backUrl?has_content>
                    <span class="size-40 shrink-0" aria-hidden="true"></span>
                </#if>
            </div>

            <div class="mt-20 flex flex-col gap-20">
                <#-- App-initiated actions don't show the "you need to do X" warnings of a login. -->
                <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                    <p class="rounded-20 bg-field px-20 py-12 text-center text-16 <#if message.type = 'error'>text-error<#else>text-text</#if>"
                       role="<#if message.type = 'error'>alert<#else>status</#if>">
                        ${kcSanitize(message.summary)?no_esc}
                    </p>
                </#if>

                <#nested "form">

                <#nested "socialProviders">

                <#if displayInfo>
                    <div class="text-center text-text-muted">
                        <#nested "info">
                    </div>
                </#if>
            </div>
        </section>

        <div class="flex flex-col items-center gap-10 md:hidden">
            <#nested "register">
        </div>
    </main>

    <footer class="flex flex-col items-center gap-10 px-16 pb-30">
        <nav class="flex gap-20" aria-label="${msg("legalNavigation")}">
            <a class="link-soft" href="${properties.appBaseUrl}/impressum">${msg("imprint")}</a>
            <a class="link-soft" href="${properties.appBaseUrl}/datenschutz">${msg("privacyPolicy")}</a>
        </nav>
        <#if realm.internationalizationEnabled && locale.supported?size gt 1>
            <nav class="flex gap-10 text-16" aria-label="${msg("languages")}">
                <#list locale.supported as l>
                    <a class="link-soft <#if l.languageTag == locale.currentLanguageTag>font-bold text-accent</#if>"
                       href="${l.url}" lang="${l.languageTag}"
                       <#if l.languageTag == locale.currentLanguageTag>aria-current="true"</#if>>${l.label}</a>
                </#list>
            </nav>
        </#if>
    </footer>
</div>
</body>
</html>
</#macro>
