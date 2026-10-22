<#ftl output_format="plainText">
<#import "../html/template.ftl" as layout>
${msg("emailGreeting")}

${msg("emailUpdateConfirmationLead", newEmail)}

${link}

${msg("emailLinkLifetime", layout.lifetime(linkExpiration))}

${msg("emailUpdateConfirmationIgnore")}


${msg("emailSignOff")}

${msg("emailSignature")}
