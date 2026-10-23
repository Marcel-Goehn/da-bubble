import { APIRequestContext, expect } from '@playwright/test';

const mailpitUrl = 'http://localhost:8025';

/** An email Keycloak sent, as Mailpit caught it. */
export interface Email {
  Subject: string;
  Text: string;
  HTML: string;
}

/** Waits for the first email to [address] and returns it. Every address in a test is unique. */
export async function emailTo(request: APIRequestContext, address: string): Promise<Email> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mailpitUrl}/api/v1/search`, {
          params: { query: `to:"${address}"` },
        });
        const { messages } = (await response.json()) as { messages: { ID: string }[] };
        id = messages[0]?.ID;
        return id;
      },
      { message: `an email to ${address}` },
    )
    .toBeDefined();
  const response = await request.get(`${mailpitUrl}/api/v1/message/${id}`);
  await expect(response).toBeOK();
  return (await response.json()) as Email;
}

/** The one link in the text part of [email], where Keycloak's templates put it on its own line. */
export function linkIn(email: Email): string {
  const link = /^https?:\/\/\S+$/m.exec(email.Text)?.[0];
  expect(link, 'a link in the email').toBeDefined();
  return link!;
}
