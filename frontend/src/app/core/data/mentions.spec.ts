import {
  activeMentionQuery,
  Mention,
  mentionToken,
  MentionLookup,
  renderMessageText,
  toDisplayText,
  toTokenText,
} from './mentions';

const adaId = '7d1e0c2a-0000-4000-8000-000000000001';
const alanId = '7d1e0c2a-0000-4000-8000-000000000002';

const ada: Mention = { kind: 'user', id: adaId, name: 'Ada Lovelace' };
const development: Mention = { kind: 'channel', id: 7, name: 'Entwicklung' };

/** Ada is now "Ada King"; Alan is unknown; the User is a Member of Channel 7 (now "Dev") and 1 (Default). */
const lookup: MentionLookup = {
  userName: (id) => (id === adaId ? 'Ada King' : undefined),
  channelName: (id) => ({ 1: 'Allgemein', 7: 'Dev' })[id],
};

describe('renderMessageText', () => {
  it('shows Mentions under the current names, between the text around them', () => {
    expect(
      renderMessageText(`Hallo <@${adaId}|Ada Lovelace>, siehe <#7|Entwicklung>!`, lookup),
    ).toEqual([
      { kind: 'text', text: 'Hallo ' },
      { kind: 'user', id: adaId, name: 'Ada King' },
      { kind: 'text', text: ', siehe ' },
      { kind: 'channel', id: 7, name: 'Dev' },
      { kind: 'text', text: '!' },
    ]);
  });

  it('shows the Default Channel under whatever name the lookup gives it, e.g. translated', () => {
    expect(renderMessageText('<#1|General>', lookup)).toEqual([
      { kind: 'channel', id: 1, name: 'Allgemein' },
    ]);
  });

  it('falls back to plain text with the name at the time of writing for an unknown User or Channel', () => {
    expect(
      renderMessageText(`<@${alanId}|Alan Turing> in <#9|Geheim> und <#7|Entwicklung>`, lookup),
    ).toEqual([
      { kind: 'text', text: '@Alan Turing in #Geheim und ' },
      { kind: 'channel', id: 7, name: 'Dev' },
    ]);
  });

  it('reads escaped names and leaves malformed tokens as they are', () => {
    expect(renderMessageText(String.raw`<#9|a\>b\\c> <#x|y> <@${adaId} Ada>`, lookup)).toEqual([
      { kind: 'text', text: String.raw`#a>b\c <#x|y> <@${adaId} Ada>` },
    ]);
  });

  it('is plain text without Mentions', () => {
    expect(renderMessageText('Hallo', lookup)).toEqual([{ kind: 'text', text: 'Hallo' }]);
  });
});

describe('mentionToken', () => {
  it('escapes the name so it reads back the same', () => {
    const odd: Mention = { kind: 'channel', id: 9, name: String.raw`a>b\c` };

    expect(mentionToken(odd)).toBe(String.raw`<#9|a\>b\\c>`);
    expect(
      renderMessageText(mentionToken(ada), {
        userName: () => undefined,
        channelName: () => undefined,
      }),
    ).toEqual([{ kind: 'text', text: '@Ada Lovelace' }]);
  });
});

describe('the composer text', () => {
  it('shows tokens as @Name and #Name, and turns them back into the same tokens', () => {
    const tokens = `Hallo <@${adaId}|Ada Lovelace>, siehe <#7|Entwicklung>`;

    const { text, mentions } = toDisplayText(tokens);

    expect(text).toBe('Hallo @Ada Lovelace, siehe #Entwicklung');
    expect(mentions).toEqual([ada, development]);
    expect(toTokenText(text, mentions)).toBe(tokens);
  });

  it('makes every whole @Name of a picked Mention a token, and leaves the rest as typed', () => {
    expect(toTokenText('@Ada Lovelace, @Ada Lovelacex, mail@Ada Lovelace, @Grace', [ada])).toBe(
      `<@${adaId}|Ada Lovelace>, @Ada Lovelacex, mail@Ada Lovelace, @Grace`,
    );
  });

  it('prefers the longest name when one starts with another', () => {
    const shortAda: Mention = { kind: 'user', id: alanId, name: 'Ada' };

    expect(toTokenText('@Ada Lovelace und @Ada', [shortAda, ada])).toBe(
      `<@${adaId}|Ada Lovelace> und <@${alanId}|Ada>`,
    );
  });

  it('keeps a Mention plain text once part of its name is deleted', () => {
    expect(toTokenText('@Ada Lovelac', [ada])).toBe('@Ada Lovelac');
  });
});

describe('activeMentionQuery', () => {
  it('is what follows an @ or # at the start or after a space, up to the caret', () => {
    expect(activeMentionQuery('@', 1)).toEqual({ trigger: '@', start: 0, query: '' });
    expect(activeMentionQuery('Hallo #Ent', 10)).toEqual({ trigger: '#', start: 6, query: 'Ent' });
    expect(activeMentionQuery('Hi @Ada Lo und', 10)).toEqual({
      trigger: '@',
      start: 3,
      query: 'Ada Lo',
    });
  });

  it('is nothing without a trigger, inside a word, or across a line break', () => {
    expect(activeMentionQuery('Hallo', 5)).toBeNull();
    expect(activeMentionQuery('mail@example', 12)).toBeNull();
    expect(activeMentionQuery('@Ada\nLo', 7)).toBeNull();
  });
});
