<#ftl output_format="plainText">
<#import "../html/template.ftl" as layout>
${msg("emailGreeting")}

${msg("emailVerificationLead")}

${link}

${msg("emailLinkLifetime", layout.lifetime(linkExpiration))}

${msg("emailVerificationIgnore")}


${msg("emailSignOff")}

${msg("emailSignature")}
