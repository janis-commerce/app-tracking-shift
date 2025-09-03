// STORAGE KEYS
export const SHIFT_ID = 'shift.id';
export const SHIFT_STATUS = 'shift.status';
export const SHIFT_DATA = 'shift.data';
export const WORKLOG_TYPES_DATA = 'worklogTypes.data';
export const CURRENT_WORKLOG_ID = 'worklog.id';
export const CURRENT_WORKLOG_DATA = 'worklog.data';
export const STAFF_AUTH = 'staff.authorization';
export const OFFLINE_DATA = 'offline.data';

// EXPIRATION TIMES
export const WORKLOG_TYPES_EXPIRATION_TIME = 4 * 60 * 60 * 1000; // 4 hours
export const STAFF_MS_AUTHORIZATION_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hour

// EXCLUDED WORKLOG TYPES
export const EXCLUDED_WORKLOG_TYPES = ['default-picking-work', 'default-delivery-work'];

// INTERNAL DEFAULT WORKLOGS
export const INTERNAL_WORKLOGS = {
	PICKING_WORK: {
		referenceId: 'default-picking-work',
		type: 'work',
		name: 'Default picking work',
	},
	DELIVERY_WORK: {
		referenceId: 'default-delivery-work',
		type: 'work',
		name: 'Default delivery work',
	},
};

// SHIFT CLOSE EXTENSION
export const DEFAULT_REOPENING_EXTENSION_TIME = 60 * 60 * 1000; // 1 hour
