# DA Bubble

A Slack-style chat application where people talk to each other in channels and direct messages.

## Language

**User**:
A person who has signed up for DA Bubble and verified their email. They're identified by an ID that never changes, even when their name or email changes.
_Avoid_: Account, Profile

**Workspace**:
The shared space every User belongs to. For now there is exactly one, and every User can see and message every other User.
_Avoid_: Organization, Team, Server

**Avatar**:
The picture that represents a User wherever they appear.
_Avoid_: Profile picture, Icon

**Presence**:
Whether a User is currently online or offline.
_Avoid_: Status, Activity

## Conversations

**Conversation**:
A place where Messages are exchanged: either a Channel or a Direct Message.
_Avoid_: Chat, Room

**Channel**:
A named, topic-based Conversation open to its Members.
_Avoid_: Group, Room

**Member**:
A User who belongs to a particular Channel. A role within that Channel, not another word for User.
_Avoid_: Participant

**Admin**:
A Member who may change a Channel and decide who belongs to it. A Channel's creator is always one of its Admins.
_Avoid_: Owner, Moderator

**Default Channel**:
The Channel "Allgemein", which every User belongs to and cannot leave.
_Avoid_: Base channel, General channel

**Direct Message**:
The private Conversation between two Users, or between a User and themselves. Abbreviated DM.
_Avoid_: Private chat, PM

**Message**:
A single post by a User in a Conversation.
_Avoid_: Post, Chat message

**Thread**:
The Replies hanging off one Message.
_Avoid_: Sub-conversation

**Reply**:
A Message inside a Thread.
_Avoid_: Answer, Comment

**Reaction**:
An emoji a User attaches to a Message; each User adds a given emoji at most once.
_Avoid_: Like, Emote

**Mention**:
A reference to a User (`@`) or a Channel (`#`) inside a Message.
_Avoid_: Tag, Ping
