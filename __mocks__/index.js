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
