<#ftl output_format="plainText">
<#import "../html/template.ftl" as layout>
${msg("emailGreeting")}

${msg("passwordResetLead")}

${link}

${msg("emailLinkLifetime", layout.lifetime(linkExpiration))}

${msg("passwordResetIgnore")}


${msg("emailSignOff")}

${msg("emailSignature")}
