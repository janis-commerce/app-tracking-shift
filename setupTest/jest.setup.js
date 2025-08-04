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
