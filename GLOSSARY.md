# DA Bubble

A Slack-style chat application where people talk to each other in channels and direct messages.

## Language

**User**:
A person with a verified identity in DA Bubble: either someone who signed up and verified their email, or the Guest. They're identified by an ID that never changes, even when their name or email changes.
_Avoid_: Account, Profile

**Guest**:
The one shared User anyone can sign in as from the login page to try DA Bubble without signing up. Everyone who signs in as the Guest is the same User; its name and credentials can't be changed.
_Avoid_: Demo user, Anonymous user

**Workspace**:
The shared space every User belongs to. For now there is exactly one, and every User can see and message every other User.
_Avoid_: Organization, Team, Server

**Avatar**:
The picture that represents a User wherever they appear: one of the predefined pictures, or one the User uploaded. Every User can see it; only its owner can change or remove it.
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
A Member who may change a Channel and decide who belongs to it.
_Avoid_: Moderator

**Creator**:
The User who created a Channel. Always one of its Admins, can never leave or be removed, and is the only one who may delete it.
_Avoid_: Owner

**Default Channel**:
The Channel "Allgemein", which every User belongs to and cannot leave. It has no Creator and no Admins, so nobody can change it.
_Avoid_: Base channel, General channel

**Direct Message**:
The private Conversation between two Users, or between a User and themselves (their self-DM). There is at most one per pair of Users. Abbreviated DM.
_Avoid_: Private chat, PM

**Message**:
A single post by a User in a Conversation.
_Avoid_: Post, Chat message

**Thread**:
The Replies hanging off one Message, identified by that Message. Threads are one level deep.
_Avoid_: Sub-conversation

**Reply**:
A Message inside a Thread. A Reply cannot have a Thread of its own.
_Avoid_: Answer, Comment

**Deleted Message**:
A Message its author has deleted. It keeps its place, author and time, but its content is gone.
_Avoid_: Removed message

**Attachment**:
A file sent as part of a Message, visible to whoever can currently see the Conversation.
_Avoid_: Upload, File

**Pending Upload**:
A file a User has uploaded but not yet used: not yet sent as an Attachment or saved as their Avatar. Only its uploader can use it, and it's discarded if unused for about a day.
_Avoid_: Draft attachment, Temp file

**Unread**:
A Message or Reply by someone else that arrived after a User last opened its Conversation (or, for "N neu", its Thread) and after they joined.
_Avoid_: New, Unseen

**Reaction**:
An emoji a User attaches to a Message; each User adds a given emoji at most once.
_Avoid_: Like, Emote

**Mention**:
A reference to a User (`@`) or a Channel (`#`) inside a Message.
_Avoid_: Tag, Ping
