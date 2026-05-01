# Dr. UPSC — Flashcards & Notes Pro Improvements

## Context
Repo: https://github.com/upsc-serv-1/app-2.6 (pulled fresh into /app/frontend)
Stack: Expo SDK 54, React 19, Supabase, MMKV (added), AsyncStorage fallback.

## What was broken
"Add to Flashcard" buttons (quiz engine, attempt result, repo) created `cards` + `user_cards` rows but never linked the card to a `flashcard_branch`. The Deck Hub reads from `flashcard_branch_cards`, so cards existed in DB but never appeared in the UI.

## What was implemented (this iteration)
1. **Universal `AddToFlashcardSheet`** (`src/components/flashcards/AddToFlashcardSheet.tsx`)
   - After card creation, opens a sheet with two choices:
     - **Auto-place** → builds Subject → Section Group → Microtopic branches idempotently and links card to leaf.
     - **Choose location** → tree picker with inline "+ create sub-deck" at every node and "+ New root deck" button.
   - Wired into: `app/unified/engine.tsx`, `app/unified/result/[aid].tsx`, `src/components/RepoQuestionCard.tsx`.

2. **`BranchPlacement` service** (`src/services/BranchPlacement.ts`)
   - `autoPlace`, `placeAt`, `moveCard` (used by Move-card flow).
   - `ensureBranch` is idempotent — no duplicates created.

3. **Move card freely between decks**
   - `microtopic.tsx` Move action now opens `AddToFlashcardSheet` in MOVE mode.
   - Removes from source branch and adds to target in a single op.

4. **MMKV + Dirty Queue (incremental)**
   - Installed `react-native-mmkv`. `LocalStore` now uses native MMKV when available, falls back to AsyncStorage on Expo Go/web.
   - Already wired into review path in `FlashcardSvc.reviewCard`.
   - Background sync loop runs every 60 s (`startBackgroundSync`).

5. **Notes Pro tab redesigned** (`app/notes/index.tsx`)
   - iOS Files-26 style: large title, search, segmented Grid/List toggle (persisted in AsyncStorage), generous spacing.
   - Grid: 2-column tiles with icon + title + item count.
   - List: roomy rows with icon + title + subtitle + chevron.
   - Long-press OR ⋯ menu opens action sheet: Add inside / Rename / Move / Duplicate / Delete.
   - Forward navigation via stack instead of nested expand/collapse.

6. **Notebook editor (in quiz engine)**
   - New `NotebookLocationPicker` popup (`src/components/NotebookLocationPicker.tsx`): tree of folders/notebooks, tap a notebook to use it, or pick a folder and create a new notebook in it.
   - "LOCATION" button in NotebookModal header opens the picker.
   - Keyboard handling fixed: `KeyboardAvoidingView` uses `'height'` on Android, ScrollView has `keyboardShouldPersistTaps="handled"` and 80 px bottom padding so inputs aren't blocked.
   - Reduced visual congestion in the bottom save section.

## Deferred (call out for next iteration)
- Notes Pro editor toolbar parity inside the engine NotebookModal — current engine notebook still uses plain `TextInput` with a 3-button (BOLD/ITALIC/MARK) toolbar; the standalone Notes editor (`app/notes/editor.tsx`) already uses `RichNoteEditor` with a richer toolbar. Aligning them requires migrating the engine bullets model to HTML, which is non-trivial.
- Full MMKV migration of the questions cache, bookmarks, and review tags (currently still go directly to Supabase).

## Test credentials
No new auth credentials added in this iteration. Existing Supabase auth unchanged.
