<#-- one layout for every email: greeting, lead, link, lifetime, ignore line, signature, logo (Figma "17. Gmail - email") -->
<#-- linkExpiration is in minutes; Keycloak's formatter says "1 Tag" for 1440, the Figma says "24 Stunden" -->
<#function lifetime minutes>
<#return (minutes % 60 == 0)?then(msg("emailLinkLifetimeHours", minutes / 60), linkExpirationFormatter(minutes))>
</#function>
<#macro emailLayout preheader lead linkText ignore>
<!doctype html>
<html lang="${locale.language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:900px;font-family:Roboto,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.4;color:#202124">
<tr><td>
<p style="margin:0 0 22px">${msg("emailGreeting")}</p>
<p style="margin:0 0 22px">${lead}</p>
<p style="margin:0 0 22px"><a href="${link}" style="color:#444df2;text-decoration:none">${linkText}</a></p>
<p style="margin:0 0 22px">${msg("emailLinkLifetime", lifetime(linkExpiration))}</p>
<p style="margin:0 0 22px">${ignore}</p>
<p style="margin:44px 0 22px">${msg("emailSignOff")}</p>
<p style="margin:0 0 22px">${msg("emailSignature")}</p>
<img src="${url.resourcesUrl}/img/logo.png" width="257" height="74" alt="DABubble" style="display:block;border:0">
</td></tr></table></td></tr></table>
</body>
</html>
</#macro>
