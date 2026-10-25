/**
 * Mentions in Message text. The text holds a token per Mention with the id and the name at the time of
 * writing: `<@user-uuid|Name>` for a User, `<#channel-id|Name>` for a Channel; in the name, `\` escapes a `>`
 * or a `\`. The backend parses the same grammar. Anything else, malformed tokens included, is plain text.
 */

/** A User or Channel a Message mentions, with the name it's written under. */
export type Mention =
  { kind: 'user'; id: string; name: string } | { kind: 'channel'; id: number; name: string };

/** A piece of a Message as shown: plain text, or a Mention under its current name. */
export type MessagePart = { kind: 'text'; text: string } | Mention;

/** The current names of the Users and Channels a Message may mention; `undefined` for one not to show. */
export interface MentionLookup {
  /** A known User's name. */
  userName(id: string): string | undefined;
  /** The shown name of a Channel the User is a Member of, e.g. translated for the Default Channel. */
  channelName(id: number): string | undefined;
}

const token =
  /<(?:@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|#(\d{1,18}))\|((?:[^\\>\n]|\\[\\>])*)>/g;

/** [text] split into plain text and the Mentions in it, under the names they were written with. */
function parse(text: string): (string | Mention)[] {
  const pieces: (string | Mention)[] = [];
  let last = 0;
  for (const match of text.matchAll(token)) {
    const [whole, userId, channelId, escapedName] = match;
    pieces.push(text.slice(last, match.index));
    const name = escapedName.replace(/\\([\\>])/g, '$1');
    pieces.push(
      userId !== undefined
        ? { kind: 'user', id: userId, name }
        : { kind: 'channel', id: Number(channelId), name },
    );
    last = match.index + whole.length;
  }
  pieces.push(text.slice(last));
  return pieces.filter((piece) => piece !== '');
}

/** What starts a Mention of [mention]'s kind. */
export function triggerOf(mention: Mention): MentionTrigger {
  return mention.kind === 'user' ? '@' : '#';
}

/** How [mention] reads as plain text: `@Name` or `#Name`. */
function plain(mention: Mention): string {
  return triggerOf(mention) + mention.name;
}

/**
 * [text] as a Message shows it: each Mention under the current name [lookup] gives it, and one it doesn't
 * know (a User it hasn't loaded, a Channel the User isn't a Member of or that was deleted) as plain text
 * under the name it was written with.
 */
export function renderMessageText(text: string, lookup: MentionLookup): MessagePart[] {
  const parts: MessagePart[] = [];
  const addText = (more: string) => {
    const previous = parts.at(-1);
    if (previous?.kind === 'text') {
      parts[parts.length - 1] = { kind: 'text', text: previous.text + more };
    } else {
      parts.push({ kind: 'text', text: more });
    }
  };
  for (const piece of parse(text)) {
    if (typeof piece === 'string') {
      addText(piece);
      continue;
    }
    const current =
      piece.kind === 'user' ? lookup.userName(piece.id) : lookup.channelName(piece.id);
    if (current === undefined) {
      addText(plain(piece));
    } else {
      parts.push({ ...piece, name: current });
    }
  }
  return parts;
}

/** The token for [mention]. */
export function mentionToken(mention: Mention): string {
  const name = mention.name.replace(/\\/g, '\\\\').replace(/>/g, '\\>');
  return `<${triggerOf(mention)}${mention.id}|${name}>`;
}

/** Message text as the composer shows it: each token as `@Name` or `#Name`, and the Mentions they were. */
export function toDisplayText(text: string): { text: string; mentions: Mention[] } {
  const pieces = parse(text);
  return {
    text: pieces.map((piece) => (typeof piece === 'string' ? piece : plain(piece))).join(''),
    mentions: pieces.filter((piece) => typeof piece !== 'string'),
  };
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The composer's [text] back as Message text: each whole `@Name` or `#Name` of one of the [mentions] becomes
 * its token, the longest name first; the first of several Mentions with the same name wins. What no longer
 * reads as one, e.g. after part of the name was deleted, stays as typed.
 */
export function toTokenText(text: string, mentions: readonly Mention[]): string {
  const byPlain = new Map<string, Mention>();
  for (const mention of mentions) {
    if (!byPlain.has(plain(mention))) {
      byPlain.set(plain(mention), mention);
    }
  }
  if (byPlain.size === 0) {
    return text;
  }
  const names = [...byPlain.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const whole = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${names.join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
  return text.replace(whole, (found) => mentionToken(byPlain.get(found)!));
}

/** What starts a Mention: `@` for a User, `#` for a Channel. */
export type MentionTrigger = '@' | '#';

/** A Mention being typed: its trigger, where the trigger stands, and what follows it up to the caret. */
export interface MentionQuery {
  trigger: MentionTrigger;
  start: number;
  query: string;
}

/**
 * The Mention being typed in [text] with the caret at [caret]: an `@` or `#` at the start or after
 * whitespace, followed by anything but a line break up to the caret. `null` when there is none.
 */
export function activeMentionQuery(text: string, caret: number): MentionQuery | null {
  const match = /(?:^|\s)([@#])([^\n@#]*)$/.exec(text.slice(0, caret));
  if (match === null) {
    return null;
  }
  const [, trigger, query] = match;
  return { trigger: trigger as MentionTrigger, start: caret - query.length - 1, query };
}
