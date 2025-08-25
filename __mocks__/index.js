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
	getElapsedTime: jest.fn(),
	searchEventByQuery: jest.fn(),
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

// Mock para WorkLogs (raw data)
export const mockWorkLogsRaw = [
	{
		id: '631fb04c8fe08f51a8ee5949',
		shiftId: 'shift-123',
		workLogTypeId: '631fb04c8fe08f51a8ee5949',
		workLogTypeRefId: 'default-picking-work',
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

// Mock para WorkLogs (formatted data)
export const mockWorkLogs = [
	{
		id: 'picking-631fb04c8fe08f51a8ee5949',
		shiftId: 'shift-123',
		referenceId: 'default-picking-work',
		startDate: '2024-01-15T09:00:00.000Z',
		endDate: '2024-01-15T17:00:00.000Z',
		status: 'finished',
		name: 'Picking from store',
	},
	{
		id: '631fb04c8fe08f51a8ee5950',
		shiftId: 'shift-123',
		referenceId: 'packaging-001',
		startDate: '2024-01-15T14:00:00.000Z',
		endDate: '2024-01-15T15:30:00.000Z',
		status: 'finished',
		name: 'Packaging',
	},
	{
		id: '631fb04c8fe08f51a8ee5951',
		shiftId: 'shift-123',
		referenceId: 'delivery-001',
		startDate: '2024-01-15T16:00:00.000Z',
		endDate: undefined,
		status: 'inProgress',
		name: 'Delivery',
	},
];

export const mockShiftData = {
	id: 'shift-123',
	startDate: '2024-01-15T09:00:00.000Z',
	status: 'opened',
	dateToClose: '2024-01-15T17:00:00.000Z',
	dateMaxToClose: '2024-01-15T17:00:00.000Z',
	userId: '6a1fc1eeb5b68406e0487a10',
	displayId: '240715-EARPIQ',
	dateCreated: '2019-07-12T19:00:00.000Z',
	dateModified: '2019-07-20T19:00:00.000Z',
	userCreated: '6a1fc1eeb5b68406e0487a10',
	userModified: '7e1fc1eeb5b68406e048796',
};

// Mock para TrackerRecords
export const mockTrackerRecords = {
	getWorkLogsFromTimeTracker: jest.fn(),
	getStartDateById: jest.fn(),
	getEndDateById: jest.fn(),
};

// Datos de ejemplo para workLogsEvents
export const mockWorkLogsEvents = [
	{
		id: 'event-1',
		time: '2024-01-15T10:00:00.000Z',
		type: 'start',
		payload: {
			type: 'work',
			name: 'Trabajo Principal',
			shiftId: 'shift-123',
			referenceId: 'ref-1',
		},
	},
	{
		id: 'event-2',
		time: '2024-01-15T11:00:00.000Z',
		type: 'start',
		payload: {
			type: 'pause',
			name: 'Pausa',
			shiftId: 'shift-123',
			referenceId: 'ref-2',
		},
	},
	{
		id: 'event-3',
		time: '2024-01-15T11:30:00.000Z',
		type: 'finish',
		payload: {
			type: 'pause',
			name: 'Pausa',
			shiftId: 'shift-123',
			referenceId: 'ref-2',
		},
	},
	{
		id: 'event-4',
		time: '2024-01-15T12:00:00.000Z',
		type: 'finish',
		payload: {
			type: 'work',
			name: 'Trabajo Principal',
			shiftId: 'shift-123',
			referenceId: 'ref-1',
		},
	},
];

// Datos de ejemplo para actividades formateadas
export const mockFormattedActivities = [
	{
		type: 'work',
		name: 'Trabajo Principal',
		startTime: '2024-01-15T10:00:00.000Z',
		endTime: '2024-01-15T12:00:00.000Z',
		duration: 7200000, // 2 horas en milisegundos
	},
	{
		type: 'pause',
		name: 'Pausa',
		startTime: '2024-01-15T11:00:00.000Z',
		endTime: '2024-01-15T11:30:00.000Z',
		duration: 1800000, // 30 minutos en milisegundos
	},
];
