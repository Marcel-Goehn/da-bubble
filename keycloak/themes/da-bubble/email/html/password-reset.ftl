<#import "template.ftl" as layout>
<@layout.emailLayout>
    <p style="margin:0 0 16px;">${msg("passwordResetIntro")}</p>
    <@layout.link href=link label=msg("passwordResetLink")/>
    <p style="margin:0 0 16px;">${msg("passwordResetLifetime")}</p>
    <p style="margin:0 0 16px;">${msg("passwordResetIgnore")}</p>
</@layout.emailLayout>
