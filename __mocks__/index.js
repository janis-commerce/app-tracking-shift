// Mock para @janiscommerce/app-request
export const mockRequest = {
	get: jest.fn(),
	list: jest.fn(() => Promise.resolve({result: []})),
	patch: jest.fn(),
	post: jest.fn(),
};

// Mock para @janiscommerce/app-tracking-time
export const mockTimeTracker = {
	addEvent: jest.fn(),
	deleteAllEvents: jest.fn(),
};

// Mock para Crashlytics
export const mockCrashlytics = {
	log: jest.fn(),
	recordError: jest.fn(),
	setAttribute: jest.fn(),
	setAttributes: jest.fn(),
	setUserId: jest.fn(),
	setCrashlyticsCollectionEnabled: jest.fn(),
	isCrashlyticsCollectionEnabled: true,
};

// Mock para react-native-mmkv
export const mockMMKV = {
	set: jest.fn(),
	getString: jest.fn(),
	getNumber: jest.fn(),
	getBoolean: jest.fn(),
	getObject: jest.fn(),
	getBuffer: jest.fn(),
	delete: jest.fn(),
	clearAll: jest.fn(),
	contains: jest.fn(() => false),
	getAllKeys: jest.fn(() => []),
	recursiveDelete: jest.fn(),
	addOnValueChangedListener: jest.fn(() => () => {}),
};

// Mock para WorkLogs
export const mockWorkLogs = [
	{
		id: '631fb04c8fe08f51a8ee5949',
		shiftId: 'shift-123',
		workLogTypeId: '631fb04c8fe08f51a8ee5949',
		workLogTypeRefId: 'picking-store-001',
		workLogTypeName: 'Picking from store',
		userId: '6a1fc1eeb5b68406e0487a10',
		startDate: '2024-01-15T09:00:00.000Z',
		endDate: '2024-01-15T17:00:00.000Z',
		time: 480,
		status: 'finished',
		dateCreated: '2024-01-15T09:00:00.000Z',
		dateModified: '2024-01-15T17:00:00.000Z',
		userCreated: '6a1fc1eeb5b68406e0487a10',
		userModified: '7e1fc1eeb5b68406e048796',
	},
	{
		id: '631fb04c8fe08f51a8ee5950',
		shiftId: 'shift-123',
		workLogTypeId: '631fb04c8fe08f51a8ee5950',
		workLogTypeRefId: 'packaging-001',
		workLogTypeName: 'Packaging',
		userId: '6a1fc1eeb5b68406e0487a10',
		startDate: '2024-01-15T14:00:00.000Z',
		endDate: '2024-01-15T15:30:00.000Z',
		time: 90,
		status: 'finished',
		dateCreated: '2024-01-15T14:00:00.000Z',
		dateModified: '2024-01-15T15:30:00.000Z',
		userCreated: '6a1fc1eeb5b68406e0487a10',
		userModified: '7e1fc1eeb5b68406e048796',
	},
	{
		id: '631fb04c8fe08f51a8ee5951',
		shiftId: 'shift-123',
		workLogTypeId: '631fb04c8fe08f51a8ee5951',
		workLogTypeRefId: 'delivery-001',
		workLogTypeName: 'Delivery',
		userId: '6a1fc1eeb5b68406e0487a10',
		startDate: '2024-01-15T16:00:00.000Z',
		status: 'inProgress',
		dateCreated: '2024-01-15T16:00:00.000Z',
		dateModified: '2024-01-15T16:00:00.000Z',
		userCreated: '6a1fc1eeb5b68406e0487a10',
		userModified: '7e1fc1eeb5b68406e048796',
	},
];
