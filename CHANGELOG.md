# Changelog

## [Unreleased]

## [1.6.0] 2025-02-11

### Added

- `update()` method in Shift class to update shift warehouse without reopening

### Changed

- `open()` method now accepts optional `warehouseId` parameter

## [1.5.0] 2026-01-08

### Removed

- Peer dependency react-dom

## [1.4.0] 2025-12-02

### Added

- Realtime activity reporting when internet is reachable [APPSRN-453](https://janiscommerce.atlassian.net/browse/APPSRN-453)
- Storage layer using @janiscommerce/app-storage [APPSRN-453](https://janiscommerce.atlassian.net/browse/APPSRN-453)
- Hook useStorageValue with change listeners [APPSRN-453](https://janiscommerce.atlassian.net/browse/APPSRN-453)
- Beta publish workflow for alpha/beta/rc tags [APPSRN-453](https://janiscommerce.atlassian.net/browse/APPSRN-453)

### Changed

- Use Node 18 and npm cache in workflows [APPSRN-453](https://janiscommerce.atlassian.net/browse/APPSRN-453)
- Branch coverage threshold set to 90% [APPSRN-453](https://janiscommerce.atlassian.net/browse/APPSRN-453)
- ShiftWorklogs: rename postPendingBatch to batch, add createId/formatForJanis [APPSRN-453](https://janiscommerce.atlassian.net/browse/APPSRN-453)
- Provider: shift state and current worklog managed via Shift and storage objects [APPSRN-453](https://janiscommerce.atlassian.net/browse/APPSRN-453)

### Removed

- useMMKVObject hook and deleteStoredWorkLog utility [APPSRN-453](https://janiscommerce.atlassian.net/browse/APPSRN-453)
- utils/storage getObject/setObject helpers and OfflineData.getLastRecord [APPSRN-453](https://janiscommerce.atlassian.net/browse/APPSRN-453)

## [1.4.0-beta.5] 2025-11-18

### Changed

- shift finish method will not update the shift status.

## [1.4.0-beta.4] 2025-11-13

### Added

- properties to get staff authorization and client worklogs

## [1.4.0-beta.3] 2025-11-12

### Changed

- changed shift privates methods visibility

## [1.4.0-beta.2] 2025-11-12

### Changed

- names of the methods that check shift expiration

## [1.4.0-beta.1] 2025-11-12

### Added

- Realtime activity reporting when user has internet connection
- Beta release workflow

## [1.3.0] - 2025-11-06

### Added

- hasWorkLogsTypes boolean

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
