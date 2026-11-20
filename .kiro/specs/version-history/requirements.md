# Requirements Document

## Introduction

A weaver who changes a saved naksha today must either overwrite the old Saved_Design or save a second, unrelated one. Version history lets a Saved_Design continue as a lineage of versions. The weaver can save a change without losing the old Pattern, see the versions, compare two of them and restore one. Comparison reuses the existing Code view Diff (`diffPatterns` in `src/codec-view`); no second diff is written.

## Glossary

- **Design**: A lineage of one or more Versions, identified by a design id.
- **Version**: One saved record in the lineage of a Design. A Version is one ordinary Archive record (Metadata, Pattern, Card_Profile name, creation time) plus an optional design id and an optional note.
- **Design_Id**: The id of the Design a Version belongs to. The Design_Id of the first Version of a Design is the id of that Version's own record. A record with no stored Design_Id has its own id as Design_Id.
- **Note**: A short optional text of at most 200 characters describing what changed in a Version.
- **Archive**: The IndexedDB-backed store of Saved_Designs in `src/archive`.
- **Saved_Design**: One stored record in the Archive, that is, one Version.
- **Metadata**: The name, naqshband, weaver, place, date and notes fields stored with a Saved_Design.
- **Pattern**: One CardGrid per pick, as defined in `src/codec`.
- **Card_Profile**: The card geometry a Pattern was made for.
- **Current_Pattern**: The Pattern the weaver has open in the app, with its origin (`archive` when loaded from the Archive).
- **Keep_Screen**: The screen where the weaver saves, lists, opens and deletes Saved_Designs.
- **Weave_Screen**: The screen that simulates the cloth for the Current_Pattern.
- **Code_View_Screen**: The screen that shows the bit lines of a Pattern and the Diff between two Patterns.
- **Diff**: The result of `diffPatterns` for two Patterns.
- **Version_List**: The list of Versions of one Design, newest first.
- **Upgrade**: The IndexedDB schema change from version 1 to version 2 that adds a `designId` index to the summaries store. The Design_Id and Note fields are optional on records, so no record is rewritten.

## Requirements

### Requirement 1: Choose how to save

**User Story:** As a weaver, I want to choose between saving a change as a new version or as a new design, so that I can keep the old naksha without overwriting it.

#### Acceptance Criteria

1. WHEN the weaver saves a Current_Pattern whose origin is `archive`, THE Keep_Screen SHALL display exactly two choices, "Save as new version" and "Save as a new design", with "Save as new version" selected by default, and SHALL write nothing to the Archive until the weaver confirms one choice, so that no existing Version or Design is overwritten.
2. WHEN the weaver saves a Current_Pattern whose origin is not `archive`, THE Keep_Screen SHALL save the Current_Pattern as the first Version of a new Design without displaying any save choice, and SHALL leave every existing Design unchanged.

### Requirement 2: Record lineage and note

**User Story:** As a weaver, I want each version to record the design it continues and a short note, so that the history explains itself.

#### Acceptance Criteria

1. WHEN the weaver saves a new Version, THE Archive SHALL store the Metadata, Pattern, Card_Profile name, creation time and the Design_Id of the Design being continued, and SHALL also store the Note exactly as entered if the weaver entered one of 1 to 200 characters. IF the Note is longer than 200 characters, THEN THE Archive SHALL store nothing, leave all previously saved Versions unchanged, and return a `write-failed` failure value whose detail says the Note is too long.
2. WHEN the weaver saves a new Design, THE Archive SHALL store its first Version with no Design_Id, so that the Design_Id read back for that first Version equals the id of that Version's own record.

### Requirement 3: List designs grouped

**User Story:** As an archivist, I want the Keep screen to list one entry per design, so that many versions do not crowd the list.

#### Acceptance Criteria

1. THE Keep_Screen SHALL list exactly one entry for each Design in the Archive, and each entry SHALL show the Metadata name of the Design's newest Version (the Version with the latest creation time) and the total number of Versions of the Design as a whole number of at least 1.
2. WHEN the weaver opens a Design entry, THE Keep_Screen SHALL show the Version_List containing exactly one row for each Version of that Design, ordered newest first, and each row SHALL show the Version's creation date, its Note (blank if the Version has no Note) and its pick count as a whole number of at least 0.

### Requirement 4: Act on a version

**User Story:** As a weaver, I want to open, compare, restore or delete any version, so that I can go back to an earlier naksha safely.

#### Acceptance Criteria

1. WHEN the weaver chooses Compare on a Version, THE Keep_Screen SHALL open the Code_View_Screen with both sides preselected and the result of `diffPatterns` shown, where one side is that Version's Pattern and the other side is the previous Version's Pattern, or the Current_Pattern if the weaver chose the open design as the comparison target.
2. WHEN the weaver chooses Restore on a Version, THE Keep_Screen SHALL load that Version's Pattern as the Current_Pattern with origin `archive`, remain on the Keep_Screen, and leave every stored Version unchanged (no Version added, altered or removed), so that the next save creates a new Version.
3. WHEN the weaver chooses Delete on a Version and confirms the deletion, THE Archive SHALL remove exactly that one Version and retain every other Version of the Design unchanged.

### Requirement 5: Delete within a lineage

**User Story:** As a weaver, I want deleting versions to keep the rest of the history sensible, so that I never lose a whole design by accident.

#### Acceptance Criteria

1. WHEN the newest Version of a Design is deleted and at least one older Version of that Design remains, THE Keep_Screen SHALL, within 500 ms of the deletion completing, list every remaining Version of that Design as its history, ordered by creation time with the next newest Version on top, and SHALL NOT list the deleted Version or change any other Design or Version in the list.
2. WHEN the last remaining Version of a Design is deleted, THE Keep_Screen SHALL, within 500 ms of the deletion completing, remove that Design from the list, SHALL keep every other Design in the list unchanged, and SHALL NOT list the removed Design again after the page is reloaded.

### Requirement 6: Upgrade existing archives

**User Story:** As an archivist, I want my existing saved designs to keep working, so that adding version history loses no data.

#### Acceptance Criteria

1. WHEN the Archive opens a version 1 IndexedDB database that contains one or more records, THE Archive SHALL perform the Upgrade to version 2 without user action, so that the number of Designs listed equals the number of records in the version 1 database, and each existing record, without being re-saved, is listed, opened and deleted as a Design with exactly one Version, with its Pattern, Metadata, Card_Profile name and creation time equal to the values stored before the Upgrade, and with no record lost or altered.

### Requirement 7: Report failures as values

**User Story:** As a weaver, I want clear failures when storage goes wrong, so that I know whether my version was saved.

#### Acceptance Criteria

1. IF the Archive cannot open storage, a write to storage fails, or the source Version of a new Version does not exist in storage at the time of saving, THEN THE Archive SHALL return a failure value whose reason is `storage-unavailable` for the first case, `write-failed` for the second case and `not-found` for the third case, SHALL leave every previously saved Version unchanged, SHALL NOT store the new Version, and SHALL NOT throw an exception or return a rejected result.

### Requirement 8: Accessibility, language and size

**User Story:** As a weaver with a basic phone, I want version history to be as easy to use as the rest of the app, so that I need no training.

#### Acceptance Criteria

1. THE Keep_Screen SHALL render every version history label and message in English and in Hindi, each taken from the translation files with no hard-coded text; SHALL make every version history control reachable with the Tab key and activatable with Enter or Space, with a visible focus indicator; SHALL give every version history control a non-empty text name that screen readers announce; SHALL convey every version history state by text or shape in addition to colour; and SHALL keep the document width no greater than the viewport width, so no horizontal scrollbar appears, at a viewport width of 320 px.
2. THE entry chunk of the production build SHALL be smaller than 204,800 bytes (200 KB) when gzipped.
