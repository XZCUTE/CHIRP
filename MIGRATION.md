# Migration Guide: Crew to Squads

## Overview
This document outlines the migration process from the legacy "Crew" feature to the new "Squads" feature. The refactor involves terminology updates, database schema changes, and new feature additions (Team Finding, Encrypted Chat).

## Changes

### 1. Terminology
- **Crew** -> **Squads**
- **Crew ID** -> **Squad ID**
- **Crew Member** -> **Squad Member**

### 2. Database Schema
- **Old Path:** `/crews/{crewId}`
- **New Path:** `/squads/{squadId}`
- **New Path:** `/recruit_posts/{postId}` (For Team Finding)

### 3. Migration Logic
A forward-compatible migration script is implemented in `SquadService.js`.
- On application load (in `Squads.jsx`), the system checks for existing data at `/crews`.
- If data exists and hasn't been migrated (checked via existence of `/squads`), it copies `/crews` data to `/squads`.
- **Note:** The original `/crews` data is preserved to ensure a safe rollback if needed.

## Rollback Procedure

If critical issues are encountered with the "Squads" feature, follow these steps to rollback:

1. **Revert Codebase:**
   - Revert changes to `CapyHome.jsx`, `Activities.jsx`, `SettingsPage.jsx` to restore "Crew" sidebar items.
   - Revert `App.jsx` to point `/crew` route to the old component (if it was backed up) or keep pointing to `Squads.jsx` but hide new features.

2. **Database Rollback:**
   - The `/crews` node in Firebase Realtime Database has **NOT** been deleted.
   - If writes occurred to `/squads` that need to be preserved, manually export `/squads` and merge with `/crews` (schema is compatible).
   - If no new data is needed, simply switch the frontend to read from `/crews` again.

## New Features
- **Team Finding:** Located in the "Recruitment" tab. Stores data in `/recruit_posts`.
- **Encrypted Chat:** Located in Squad Details view. Messages are stored in `/squads/{squadId}/messages` with `isEncrypted: true`. Content is Base64 encoded (simulation of encryption).

## Verification
- **Sidebar:** Check that "Crew" is now "Squads" in all sidebars.
- **Data:** Verify that legacy crews appear in the "Find Squads" or "My Squads" list.
- **Functionality:** Verify creating a squad, posting a recruitment ad, and sending a chat message works.
