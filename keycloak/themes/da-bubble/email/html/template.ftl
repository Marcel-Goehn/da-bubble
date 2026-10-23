<#-- Inline styles only: mail clients drop <style> and external CSS. Colours from tokens.css. -->
<#macro emailLayout>
<!DOCTYPE html>
<html lang="${locale.language}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${subject}</title>
</head>
<body style="margin:0;padding:24px;background:#ffffff;color:#000000;font-family:Nunito,Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;">
    <p style="margin:0 0 16px;">${msg("greeting")}</p>
    <#nested>
    <p style="margin:48px 0 16px;">${msg("signOff")}</p>
    <p style="margin:0 0 24px;">${msg("signature")}</p>
    <#if url??>
        <img src="${url.resourcesUrl}/img/logo.png" width="260" height="64" alt="DABubble" style="display:block;border:0;">
    <#else>
        <p style="margin:0;font-size:28px;font-weight:700;">DABubble</p>
    </#if>
</body>
</html>
</#macro>

<#macro link href label>
    <p style="margin:0 0 16px;"><a href="${href}" style="color:#444df2;">${label}</a></p>
</#macro>
