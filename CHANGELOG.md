# Changelog

## [Unreleased]

## [1.2.0] - 2025-09-18

### Added

- internal logic to openWorklog and finishWorkLog to manage ongoing activities

### Changed

- removed realm and event-tracker from project. Any storage operations are now handled by React-Native-MMKV.

### Fixed

- a conflict with dependencies
- error argument reported for crashlytics recordError
- error format returned by shift methods, now all errors have the same standard format

## [1.1.0] - 2025-09-01

### Added

- Setting validation when initializing or closing a worklog

## [1.0.1] - 2025-08-28

### Added

- Shift class to manage user's shifts
- An instance of time tracker service
- Shift react context with its provider
- StaffApiServices to handle api request for shift management.
- Function to get worklog abm
- Methods to init and finish worklogs
- Method to get shift report
- WithTrackingShift hoc
- Possibility to work offline
