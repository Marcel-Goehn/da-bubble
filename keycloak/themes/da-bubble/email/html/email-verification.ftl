<#import "template.ftl" as layout>
<@layout.emailLayout>
    <p style="margin:0 0 16px;">${msg("emailVerificationIntro")}</p>
    <@layout.link href=link label=msg("emailVerificationLink")/>
    <p style="margin:0 0 16px;">${msg("emailVerificationLifetime")}</p>
    <p style="margin:0 0 16px;">${msg("emailVerificationIgnore")}</p>
</@layout.emailLayout>
