package com.dabubble.keycloak;

import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.authenticators.conditional.ConditionalAuthenticator;
import org.keycloak.models.Constants;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

/**
 * True when the login request carries a {@code kc_action}, i.e. the client asks Keycloak to run an
 * application-initiated action (UPDATE_PASSWORD, UPDATE_EMAIL, ...) once the User is authenticated.
 * Keycloak itself never restricts these per User, so the browser flow pairs this with
 * "Condition - user role" and "Deny access" to lock the Guest.
 */
final class KcActionRequestedCondition implements ConditionalAuthenticator {
    static final KcActionRequestedCondition INSTANCE = new KcActionRequestedCondition();

    private KcActionRequestedCondition() {}

    @Override
    public boolean matchCondition(AuthenticationFlowContext context) {
        return context.getAuthenticationSession().getClientNote(Constants.KC_ACTION) != null;
    }

    @Override
    public void action(AuthenticationFlowContext context) {
        // A condition has no form to post.
    }

    @Override
    public boolean requiresUser() {
        return false;
    }

    @Override
    public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {
        // Nothing to set up.
    }

    @Override
    public void close() {
        // Stateless.
    }
}
