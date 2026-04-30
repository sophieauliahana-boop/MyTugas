# Security Specification - MyTugas

## Data Invariants
1. **User Ownership**: A user can only modify their own profile and settings.
2. **Group Membership**: Access to shared tasks and messages is strictly limited to members of the group.
3. **Immutability**: Task creation details (`createdBy`, `createdAt`, `groupId`) cannot be modified after creation.
4. **Member Role Security**: Only "admins" or "secretaries" can create or delete tasks (to be enforced if roles are used, currently open to all members for simplicity but guarded by group ID).
5. **PII Protection**: User profiles are isolated. Reads are allowed for authenticated users but updates are restricted to the owner.

## The "Dirty Dozen" Payloads (Red Team Targets)
1. **Identity Spoofing**: Attempt to update another user's profile `displayName`.
2. **Group Hijacking**: Attempt to join a group by manually setting `groupId` in a `setDoc` call without ownership.
3. **Ghost Task**: Creating a task with a `groupId` that the user does not belong to.
4. **Shadow Field**: Adding an `isAdmin: true` field to a user profile update.
5. **Deadline Forgery**: Setting a `createdAt` timestamp from the client instead of using `serverTimestamp()`.
6. **Relational Break**: Deleting a task from a group they are not a member of.
7. **Resource Poisoning**: Injecting 1MB of 0s into the `title` field of a task.
8. **ID Injection**: Using a 2KB string as a task ID.
9. **Spam Attack**: Sending a message with a forged `senderName`.
10. **State Shortcut**: marking a task completed for another user (not applicable here as completion is per-user array).
11. **Metadata Tampering**: Changing the `createdBy` field on an existing task.
12. **Blanket Read Scam**: Authenticated user trying to `list` tasks across all groups (path wildcard attack).

## Policy Logic
- **Master Gate**: All group-level access requires a `get()` call to the user document to verify the `groupId`.
- **Validation Helpers**: Every write operation must pass through `isValidUser`, `isValidTask`, or `isValidMessage`.
- **Temporal Integrity**: `createdAt` and `timestamp` fields must match `request.time`.
