import {mockRequest, mockCrashlytics, mockMMKV, mockOfflineData} from '../__mocks__';

jest.mock('@janiscommerce/app-request', () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => mockRequest),
}));

jest.mock('../lib/utils/crashlytics', () => ({
	__esModule: true,
	default: mockCrashlytics,
}));

jest.mock('@janiscommerce/oauth-native', () => ({
	__esModule: true,
	getUserInfo: jest.fn().mockReturnValue({
		appClientId: 'abcd1234-1234-g4g4-828b-BFAS2121fjA',
		aud: 'abcd1234-1234-g4g4-828b-BFAS2121fjA',
		createdAt: '2020-12-14T18:45:28.306Z',
		email: 'janis@janis.im',
		exp: 1697285104,
		family_name: 'SRL',
		given_name: 'janis',
		iat: 1697112304,
		images: {
			big: 'https://www.gravatar.com/avatar/034caa1d46010b8624d1b8cffaee9a88?d=404&s=512',
		},
		isDev: true,
		iss: 'https://id.janisdev.in',
		locale: 'en-US',
		mainColor: '#e70c6e',
		name: 'Janis SRL',
		profileName: 'Admin',
		refId: null,
		secondaryColor: '#fbfaf8',
		sub: '5fd7b2c8d71fb1e2743bb64e',
		tcode: 'validtcode',
		tcurrency: 'ARS',
		tcurrencyDisplay: 'symbol',
		tid: '631fab63f3f96415abfeabd8',
		timage:
			'https://cdn.id.janisdev.in/client-images/631fab63f3f96415abfeabd8/b25d5d55-52a5-41f8-bf22-43fc0963c875.png',
		tname: 'Fizzmod',
		updated_at: 1697053475,
	}),
}));

jest.mock('react-native-device-info', () => {
	const RNDeviceInfo = jest.requireActual(
		'react-native-device-info/jest/react-native-device-info-mock'
	);
	return {
		...RNDeviceInfo,
	};
});

jest.mock('@janiscommerce/app-device-info', () => ({
	__esModule: true,
	getDeviceModel: jest.fn(),
	getOSVersion: jest.fn(),
	getApplicationName: jest.fn(),
	getDeviceScreenMeasurements: jest.fn(),
	getNetworkState: jest.fn(),
	getInternetReachability: jest.fn(),
	getUniqueId: jest.fn(),
}));

jest.mock('../lib/StaffApiServices', () => ({
	openShift: jest.fn(),
	closeShift: jest.fn(),
	getShiftsList: jest.fn(),
	getWorkLogTypes: jest.fn(),
	postWorklog: jest.fn(),
	getSetting: jest.fn(),
}));

// Mock ShiftWorklogs
jest.mock('../lib/ShiftWorklogs', () => ({
	__esModule: true,
	default: {
		open: jest.fn(),
		finish: jest.fn(),
		getShiftTrackedWorkLogs: jest.fn(),
		getList: jest.fn(),
		batch: jest.fn(),
	},
}));

// Mock Formatter
jest.mock('../lib/Formatter', () => ({
	__esModule: true,
	default: {
		formatShiftActivities: jest.fn(),
		formatWorkLogTypes: jest.fn(),
		formatWorkLogId: jest.fn(),
		formatWorkLogsFromJanis: jest.fn(),
		splitWorkLogsByStatus: jest.fn(),
		formatOfflineWorkLog: jest.fn(),
	},
}));

// Mock StorageService
jest.mock('../lib/db/StorageService', () => ({
	__esModule: true,
	default: mockMMKV,
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
	__esModule: true,
	MMKV: jest.fn().mockImplementation(() => mockMMKV),
	useMMKVString: jest.fn((key) => {
		// Retorna un array con el valor y el setter, simulando el comportamiento real del hook
		const mockValue = mockMMKV.getString(key) || null;
		const mockSetter = jest.fn();
		return [mockValue, mockSetter];
	}),
}));

// Mock useMMKVObject hook
jest.mock('../lib/hooks/useMMKVObject', () => ({
	__esModule: true,
	useMMKVObject: jest.fn((key, defaultValue = null) => {
		// Simula el comportamiento del hook personalizado
		const rawValue = mockMMKV.getString(key);
		let parsedValue = defaultValue;

		if (rawValue) {
			try {
				parsedValue = JSON.parse(rawValue);
			} catch (e) {
				parsedValue = defaultValue;
			}
		}

		return [parsedValue];
	}),
}));

jest.mock('../lib/utils/helpers', () => {
	const actualHelpers = jest.requireActual('../lib/utils/helpers');
	return {
		__esModule: true,
		...actualHelpers,
		generateRandomId: jest.fn(() => 'mock-random-id'),
		promiseWrapper: jest.fn(),
	};
});

// Mock utils/provider functions
jest.mock('../lib/utils/provider', () => ({
	openShift: jest.fn(),
	downloadWorkLogTypes: jest.fn(),
	isAuthorizedToUseStaffMS: jest.fn(),
	getShiftWorkLogsFromJanis: jest.fn(),
}));

// Mock OfflineData
jest.mock('../lib/OfflineData', () => ({
	__esModule: true,
	default: mockOfflineData,
}));

// Mock utils/storage
jest.mock('../lib/utils/storage', () => ({
	__esModule: true,
	getWorkLogTypesData: jest.fn(),
	getStaffAuthorizationData: jest.fn(() => ({hasStaffAuthorization: true})),
}));
