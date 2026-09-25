# TaskNotes - Unreleased

<!--

**Added** for new features.
**Changed** for changes in existing functionality.
**Deprecated** for soon-to-be removed features.
**Removed** for now removed features.
**Fixed** for any bug fixes.
**Security** in case of vulnerabilities.

Always acknowledge contributors and those who report issues.

Example:

```
## Fixed

- (#768) Fixed calendar view appearing empty in week and day views due to invalid time configuration values
  - Added time validation in settings UI with proper error messages and debouncing
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

When a change has user-facing documentation, include a canonical tasknotes.dev link:

```
## Added

- Added materialized occurrence notes for recurring tasks. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#materialized-occurrence-notes) for setup and calendar behavior.
```

-->

## Added

- Added a **Duplicate event** action to calendar event context menus. The duplicate appends "duplicate" to the title and keeps the event's task fields, recurrence, reminders, media alert settings, details, and custom properties while receiving its own task file and reminder identities.
- Editing an event title in the task modal or renaming its open note now uses natural-language date ranges to update its time estimate. Ranges without a month or year are anchored to the event's scheduled date, and all-day ranges include both the first and last day.
- Added custom priorities with user-defined names and colors, including a visual color picker and controls for removing custom priorities.
- Added TaskNotes Companion-compatible desktop reminder media. Tasks can select vault video and audio files, configure looping and playback-until-dismissed behavior, and add a note to full-screen media alerts.

## Changed

- Double-clicking a calendar event to open its note now always opens the note in a new tab.
- TaskNotes command-palette and ribbon actions that open views or notes now always open them in a new tab instead of replacing or reusing an existing tab.
- Monthly calendars can display up to 99 events per day before showing the overflow label.
- Reminder video and audio start unmuted by default, and active media alerts close when a task is completed from another device.

## Fixed

- Fixed monthly multi-day events repeating into unrelated future months when the event-limit customization is enabled.
- Fixed vault media selection so files from the TaskNotes Companion media folder populate reminder video and audio fields correctly.
