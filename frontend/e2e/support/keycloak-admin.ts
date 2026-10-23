import { APIRequestContext, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const keycloakUrl = 'http://localhost:8080';
const realm = 'da-bubble';

/** A User the tests log in as. */
export interface TestUser {
  name: string;
  email: string;
  password: string;
}

/** A fresh, unique address per call, so tests never collide on the stack they share. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@e2e.dabubble.local`;
}

/** A fresh password that passes the realm's password policy. */
export function uniquePassword(): string {
  return `Pw-${randomUUID()}`;
}

async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(
    `${keycloakUrl}/realms/master/protocol/openid-connect/token`,
    {
      form: {
        grant_type: 'password',
        client_id: 'admin-cli',
        username: process.env['KEYCLOAK_ADMIN_USERNAME'] ?? 'admin',
        password: process.env['KEYCLOAK_ADMIN_PASSWORD'] ?? 'admin',
      },
    },
  );
  await expect(response, 'Keycloak admin login').toBeOK();
  const { access_token } = (await response.json()) as { access_token: string };
  return access_token;
}

/**
 * Creates a User through the Keycloak Admin API with a verified email, a password and no required
 * actions, so they log straight in. The app provisions them on their first request.
 */
export async function createVerifiedUser(request: APIRequestContext): Promise<TestUser> {
  const user = { name: 'Erika Mustermann', email: uniqueEmail('user'), password: uniquePassword() };
  const headers = { Authorization: `Bearer ${await adminToken(request)}` };
  const created = await request.post(`${keycloakUrl}/admin/realms/${realm}/users`, {
    headers,
    data: {
      username: user.email,
      email: user.email,
      firstName: user.name,
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: user.password, temporary: false }],
    },
  });
  await expect(created, 'Keycloak user creation').toBeOK();
  // Creation adds the realm's default required actions (the privacy consent); a fixture User has none.
  const location = created.headers()['location'];
  const requiredActionsCleared = await request.put(location, {
    headers,
    data: { requiredActions: [] },
  });
  await expect(requiredActionsCleared, 'Keycloak required actions').toBeOK();
  return user;
}
