# Changelog

## [Unreleased]

## [2.4.0-beta.3] 2026-05-18

### Added

- `reOpen` now accepts `{ updateStatusAfterReOpen }` option to conditionally skip the shift status update after reopening

### Changed

- `CustomError` simplified: removed `buildError` and `inferErrorCode` static methods; `isInternalError` now only checks `error.code === INTERNAL_CODE`
- `Shift` catch blocks revert to using `errorParser` for error normalization; internal errors are thrown directly via `new CustomError(message, INTERNAL_CODE)`
- `WithInactivityDetection` `startDate` calculation corrected: uses `lastTimerResetAt + timeout` (instead of `lastTimerResetAt` alone) to properly mark when inactivity began

### Removed

- `isNetworkError` helper removed from exports

## [2.4.0-beta.2] 2026-05-15

### Added

- `CustomError` class extending `Error` with `statusCode`, `code`, and `isInternalError` static method for centralized error classification
- `CustomError.buildError` static method that normalizes any error (string, API response object, or connectivity error) into a `CustomError` instance, inferring the axios error code from the message for connectivity errors
- `CustomError.isInternalError` static method to distinguish internal validation errors from API and connectivity errors, used to decide whether to save worklogs offline

### Changed

- `Shift` methods now use `CustomError.buildError` instead of `errorParser` for error normalization
- `openWorkLog` and `finishWorkLog` now use `CustomError.isInternalError` to determine if data should be saved offline, replacing the `isApiError || isNetworkError` pattern
- Removed `instanceId` from `WithInactivityDetection` `useEffect` dependencies
- Removed residual `console.log` calls from `WithInactivityDetection`

## [2.4.0-beta.1] 2026-05-08

### Added

- Now, The `_withReopenRetry` method handles whether the executed request fails because the user's shift is closed or not.
  If it fails due to the shift status, it executes the request to reopen it and then re-attempts to send the information.

## [2.4.0-beta.0] 2026-04-16

- Add inactivity in beta version

## [2.3.1] 2026-05-18

### Added

- `CustomError` class extending `Error` with `code` and `statusCode` fields, and `isInternalError` static method to distinguish internal validation errors from API/connectivity errors
- `isShiftClosedError` helper to detect "No opened shift found" API errors
- `_withReopenRetry` private method that executes a callback and, if it fails with a closed shift error, reopens the shift and retries once automatically
- `reOpen` now accepts `{ updateStatusAfterReOpen }` option to conditionally skip the status update after reopening

### Changed

- `isClosed` now checks shift status via API (`getUserOpenShift`) instead of comparing local `dateToClose` date
- `openWorkLog`, `finishWorkLog`, `finish`, `update`, and `sendPendingWorkLogs` now use `_withReopenRetry` to handle closed shift errors automatically
- `openWorkLog` and `finishWorkLog` now use `CustomError.isInternalError` to determine whether to save worklogs offline
- `WithInactivityDetection` fixes `startDate` calculation: uses `lastTimerResetAt + timeout` only when `lastTimerResetAt` is a valid number, and removes `instanceId` from `useEffect` dependencies
- `ShiftInactivity.startTimer` no longer resets `instanceId` to `null` when called without one; uses `??` to preserve the existing value

## [2.3.0] 2026-03-31

### Removed

- Work log type retrieval now returns all available active types instead of a previously restricted subset

## [2.2.0] 2026-03-30

### Added

- `WithInactivityDetection` HOC to detect user inactivity on screen and report it as a worklog [APPSRN-484](https://janiscommerce.atlassian.net/browse/APPSRN-484)
- `resetInactivityTimer` and `stopInactivityTimer` methods to `Shift` for manual timer control [APPSRN-484](https://janiscommerce.atlassian.net/browse/APPSRN-484)

## [2.2.0-beta.2] 2026-03-19

### Added

`hasInactivityDetectionEnabled` getter for the shift class detects whether the client has configured inactivity or not.

## [2.2.0-beta.1] 2026-03-19

### Added

- `WithInactivityDetection` HOC, to track user inactivity on screen and report it to Janis
- `resetInactivityTimer` and `stopInactivityTimer` to handle inactivity timer from actions that are not detected by the HOC

## [2.1.0] 2026-03-18

### Added

- `getGlobalStaffSettings` to download and save client settings in storage

## [2.0.0] 2026-03-12

### Breaking Changes

- `openWorkLog()` now throws an error instead of returning `null` when receiving an invalid worklog
- `finishWorkLog()` now throws an error instead of returning `null` when receiving an invalid worklog

### Added

- @janiscommerce/apps-helpers as peerDependency
- @janiscommerce/apps-helpers as devDependency
- support for open worklog custom start date

### Changed

- local helpers functions were replaced by apps-helpers utils
- openWorklog and finishWorkLog date parameters

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
