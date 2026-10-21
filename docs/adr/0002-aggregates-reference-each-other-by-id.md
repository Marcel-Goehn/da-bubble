# Aggregates reference each other by id, not by JPA relationships

The backend groups its entities into aggregates that are loaded and saved as a unit: **Conversation** (Channel or Direct Message, with its Memberships), **Message** (with its Reactions and Attachments), per-User **read markers**, and **pending uploads**. Inside an aggregate, the parts are real JPA relationships (`@OneToMany(cascade = ALL, orphanRemoval = true)`). Across aggregates, entities hold plain id columns (`conversationId`, `authorId`, `parentMessageId`) with no `@ManyToOne` or `@OneToMany` navigation. The database still enforces those links with foreign keys, e.g. `ON DELETE CASCADE` from Conversation to Message, so deleting a Channel is one delete. We chose this to keep each aggregate's rules (creator can't leave, one Reaction per User and emoji, edits can't empty a Message) enforced in one place, and to avoid lazy-loading and N+1 surprises and cascades that reach across boundaries.

## Considered Options

- **Navigable relationships everywhere (`Message.conversation`, `Conversation.messages`)**: the usual JPA style. Rejected because a `@OneToMany` collection of Messages can't be paginated (touching it loads every Message), and navigation makes it easy to change a Channel "through" a Message and bypass its rules.

## Consequences

- Message lists are read through repository queries with keyset pagination (newest first, older ones as the user scrolls up), not through entity collections.
- Screens that combine aggregates, such as a Message with its author's name and Avatar, use dedicated queries or projections.
