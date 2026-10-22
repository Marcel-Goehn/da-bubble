<#-- PROTOTYPE: print what this page's template can see. Each line is guarded so a missing variable prints "-" instead of failing. -->
<#macro v name><#attempt>${name}<#recover>ERR</#attempt></#macro>
<pre id="dump">
pageId=${pageId!'-'}
user??=${(user??)?c}
<#attempt>user.username=${(user.username)!'-'}<#recover>user.username=ERR</#attempt>
<#attempt>user.email=${(user.email)!'-'}<#recover>user.email=ERR</#attempt>
<#attempt>user.attributes.email=${(user.attributes.email)!'-'}<#recover>user.attributes.email=ERR</#attempt>
<#attempt>user.attributes.kc.email.pending=${(user.attributes['kc.email.pending'])!'-'}<#recover>user.attributes.kc.email.pending=ERR</#attempt>
<#attempt>user.firstName=${(user.firstName)!'-'}<#recover>user.firstName=ERR</#attempt>
login??=${(login??)?c}
<#attempt>login.username=${(login.username)!'-'}<#recover>login.username=ERR</#attempt>
usernameHidden??=${(usernameHidden??)?c}
authenticatorConfigured??=${(authenticatorConfigured??)?c}
<#attempt><#if authenticatorConfigured??>authenticatorConfigured(auth-password-form)=${authenticatorConfigured("auth-password-form")?c}</#if><#recover>authenticatorConfigured(auth-password-form)=ERR</#attempt>
<#attempt>auth.attemptedUsername=${(auth.attemptedUsername)!'-'}<#recover>auth.attemptedUsername=ERR</#attempt>
<#attempt>auth.showUsername=${(auth.showUsername())?c}<#recover>auth.showUsername=ERR</#attempt>
<#attempt>social.providers=<#if (social.providers)??><#list social.providers as p>${p.alias}<#sep>,</#list><#else>-</#if><#recover>social.providers=ERR</#attempt>
<#attempt>realm.password=${realm.password?c}<#recover>realm.password=ERR</#attempt>
authenticationSession??=${(authenticationSession??)?c}
isAppInitiatedAction??=${(isAppInitiatedAction??)?c}
<#attempt>profile.attributes=<#if (profile.attributes)??><#list profile.attributes as a>${a.name}:${a.value!''}<#sep>,</#list><#else>-</#if><#recover>profile.attributes=ERR</#attempt>
<#attempt>brokerContext.username=${(brokerContext.username)!'-'}<#recover>brokerContext.username=ERR</#attempt>
<#attempt>brokerContext.email=${(brokerContext.email)!'-'}<#recover>brokerContext.email=ERR</#attempt>
idpAlias=${idpAlias!'-'}
idpDisplayName=${idpDisplayName!'-'}
hideReviewButton??=${(hideReviewButton??)?c}
<#attempt>message.type=${(message.type)!'-'} message.summary=${(message.summary)!'-'}<#recover>message=ERR</#attempt>
statusCode=${(statusCode?c)!'-'}
skipLink??=${(skipLink??)?c}
<#attempt>client.baseUrl=${(client.baseUrl)!'-'}<#recover>client.baseUrl=ERR</#attempt>
<#attempt>url.loginAction=${(url.loginAction)!'-'}<#recover>url.loginAction=ERR</#attempt>
<#attempt>url.loginRestartFlowUrl=${(url.loginRestartFlowUrl)!'-'}<#recover>url.loginRestartFlowUrl=ERR</#attempt>
<#attempt>pageRedirectUri=${pageRedirectUri!'-'} actionUri=${actionUri!'-'}<#recover>redirect=ERR</#attempt>
</pre>
