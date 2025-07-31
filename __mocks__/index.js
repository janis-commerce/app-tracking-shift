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
