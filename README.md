# @janiscommerce/app-tracking-shift

[![npm version](https://img.shields.io/npm/v/@janiscommerce/app-tracking-shift.svg)](https://www.npmjs.com/package/@janiscommerce/app-tracking-shift)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A React Native library for managing work shifts and work logs in Janis Commerce applications. This package provides comprehensive shift tracking functionality with offline support and seamless integration with the Staff MS (Microservice).

## Features

- 🕒 **Shift Management**: Open, close, and manage work shifts
- 📝 **Work Log Tracking**: Track work activities with start/end times
- 📱 **Offline Support**: Continue working even without internet connection
- 🔄 **Automatic Sync**: Sync pending work logs when connection is restored
- 🎯 **React Context Integration**: Easy state management with React Context
- 🛡️ **Authorization Control**: Built-in staff authorization validation
- ⚡ **Performance Optimized**: Uses MMKV for fast local storage
- 🔧 **Error Handling**: Comprehensive error reporting with Crashlytics integration

## Installation

```bash
npm install @janiscommerce/app-tracking-shift
```

### Peer Dependencies

Make sure you have the following peer dependencies installed:

```bash
npm install @janiscommerce/app-crashlytics@>=2.1.0
npm install @janiscommerce/app-request@>=2.0.0
npm install react@>=17.0.2
npm install react-native@>=0.67.5
```

## Quick Start

### 1. Provider Setup

Wrap your app with the `ShiftTrackingProvider`:

```jsx
import React from 'react';
import {ShiftTrackingProvider} from '@janiscommerce/app-tracking-shift';

const App = () => {
	return (
		<ShiftTrackingProvider onError={(error) => console.error(error)}>
			{/* Your app components */}
		</ShiftTrackingProvider>
	);
};

export default App;
```

### 2. Using the Hook

Access shift data and methods using the `useShiftTracking` hook:

```jsx
import React from 'react';
import {useShiftTracking} from '@janiscommerce/app-tracking-shift';

const MyComponent = () => {
	const {
		shiftId,
		shiftStatus,
		shiftData,
		workLogTypes,
		currentWorkLogData,
		hasStaffAuthorization,
		isShiftLoading,
		error,
	} = useShiftTracking();

	return (
		<div>
			<p>Shift Status: {shiftStatus}</p>
			<p>Shift ID: {shiftId}</p>
			{/* Your component logic */}
		</div>
	);
};
```

### 3. Managing Shifts

Use the `Shift` class for shift operations:

```jsx
import {Shift} from '@janiscommerce/app-tracking-shift';

// Open a shift
const handleOpenShift = async () => {
	try {
		const shiftId = await Shift.open();
		console.log('Shift opened:', shiftId);
	} catch (error) {
		console.error('Error opening shift:', error);
	}
};

// Close a shift
const handleCloseShift = async () => {
	try {
		const shiftId = await Shift.finish();
		console.log('Shift closed:', shiftId);
	} catch (error) {
		console.error('Error closing shift:', error);
	}
};
```

### 4. Work Log Management

```jsx
// Open a work log
const handleOpenWorkLog = async () => {
	const workLog = {
		referenceId: 'task-123',
		name: 'Customer Service',
		type: 'work',
		suggestedTime: 30, // minutes
	};

	try {
		const workLogId = await Shift.openWorkLog(workLog);
		console.log('Work log opened:', workLogId);
	} catch (error) {
		console.error('Error opening work log:', error);
	}
};

// Finish a work log
const handleFinishWorkLog = async () => {
	const workLog = {
		referenceId: 'task-123',
	};

	try {
		const workLogId = await Shift.finishWorkLog(workLog);
		console.log('Work log finished:', workLogId);
	} catch (error) {
		console.error('Error finishing work log:', error);
	}
};
```

## API Reference

### ShiftTrackingProvider

The main provider component that manages shift state and initialization.

**Props:**

- `children` (ReactNode): Child components
- `onError` (function, optional): Error callback function

### useShiftTracking Hook

Returns the current shift tracking state and data.

**Returns:**

- `shiftId` (string): Current shift ID
- `shiftStatus` (string): Current shift status ('opened', 'closed', 'paused')
- `shiftData` (object): Complete shift data
- `workLogTypes` (array): Available work log types
- `currentWorkLogData` (object): Current active work log data
- `currentWorkLogId` (string): Current work log ID
- `hasStaffAuthorization` (boolean): Staff authorization status
- `isShiftLoading` (boolean): Loading state
- `error` (object): Current error state

### Shift Class

Main class for shift and work log operations.

#### Methods

**`open()`**

- Opens a new work shift
- Returns: `Promise<string>` - Shift ID

**`finish(params?)`**

- Closes the current shift
- Parameters: `{ date?: string }` - Optional closing date
- Returns: `Promise<string>` - Shift ID

**`openWorkLog(workLog)`**

- Opens a new work log
- Parameters: `{ referenceId, name, type, suggestedTime? }`
- Returns: `Promise<string>` - Work log ID

**`finishWorkLog(workLog)`**

- Finishes the current work log
- Parameters: `{ referenceId }`
- Returns: `Promise<string>` - Work log ID

**`getWorkLogs(shiftId?)`**

- Gets work logs for a shift
- Parameters: `shiftId` (optional) - Shift ID
- Returns: `Promise<Array>` - Array of work logs

**`fetchWorklogTypes()`**

- Fetches available work log types
- Returns: `Promise<Array>` - Array of work log types

**`sendPendingWorkLogs()`**

- Sends pending offline work logs
- Returns: `Promise<null>`

**`deleteShiftRegisters()`**

- Deletes all shift-related data
- Returns: `Promise<boolean>`

#### Properties

**`hasStaffAuthorize`** (getter)

- Returns: `boolean` - Staff authorization status

**`hasPendingData`** (getter)

- Returns: `boolean` - Pending offline data status

### WithShiftTracking HOC

Higher-order component that provides shift tracking data to wrapped components.

```jsx
import {WithShiftTracking} from '@janiscommerce/app-tracking-shift';

const MyComponent = ({shiftData}) => {
	// Component logic
};

export default WithShiftTracking(MyComponent, {
	pausedShiftComponent: <PausedShiftNotification />,
});
```

### Internal Work Logs

The package provides predefined internal work logs:

```jsx
import {INTERNAL_WORKLOGS} from '@janiscommerce/app-tracking-shift';

// Available internal work logs:
// INTERNAL_WORKLOGS.PICKING_WORK
// INTERNAL_WORKLOGS.DELIVERY_WORK
```

## Offline Support

The library automatically handles offline scenarios:

1. **Offline Storage**: Work logs are stored locally when offline
2. **Automatic Sync**: Pending work logs are automatically synced when connection is restored
3. **Data Persistence**: Uses MMKV for fast and reliable local storage
4. **Error Recovery**: Graceful error handling for network issues

## Error Handling

All errors are standardized and include:

- Descriptive error messages
- Error types for categorization
- Automatic Crashlytics reporting
- Promise rejection for proper error handling

## Storage Keys

The library uses the following storage keys (managed automatically):

- `shift.id` - Current shift ID
- `shift.status` - Current shift status
- `shift.data` - Complete shift data
- `worklog.id` - Current work log ID
- `worklog.data` - Current work log data
- `worklogTypes.data` - Work log types cache
- `staff.authorization` - Staff authorization data
- `offline.data` - Offline work logs

## Contributing

This package is maintained by Janis Commerce. For issues and feature requests, please use the [GitHub Issues](https://github.com/janis-commerce/app-tracking-shift/issues).

## License

MIT © [Janis Commerce](https://github.com/janis-commerce)
