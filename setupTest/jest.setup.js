import { mockRequest, mockTimeTracker } from '../__mocks__';

jest.mock('@janiscommerce/app-request', () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => mockRequest),
}));


jest.mock('@janiscommerce/app-tracking-time', () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => mockTimeTracker),
}));
