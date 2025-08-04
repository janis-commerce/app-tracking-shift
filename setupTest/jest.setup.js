import { mockRequest, mockTimeTracker, mockCrashlytics } from '../__mocks__';

jest.mock('@janiscommerce/app-request', () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => mockRequest),
}));

jest.mock('@janiscommerce/app-tracking-time', () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => mockTimeTracker),
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
	  'react-native-device-info/jest/react-native-device-info-mock',
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
	getUniqueId: jest.fn(),
  }));
  
jest.mock('../lib/StaffApiServices', () => ({
    openShift: jest.fn(),
    closeShift: jest.fn(),
    getShiftsList: jest.fn(),
}));

// Mock TimeTracker
jest.mock('../lib/db/TimeTrackerService', () => ({
    addEvent: jest.fn(),
    deleteAllEvents: jest.fn(),
}));