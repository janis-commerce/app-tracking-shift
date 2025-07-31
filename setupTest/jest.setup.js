import { mockRequest, mockTimeTracker } from '../__mocks__';

// jest.setup.js

// Mock completo de react-native
// jest.mock('react-native', () => ({
//   NativeEventEmitter: jest.fn().mockImplementation(() => ({
//     addListener: jest.fn(),
//     removeListener: jest.fn(),
//   })),
//   NativeModules: {},
//   Platform: {
//     OS: 'ios',
//     select: jest.fn(),
//   },
//   Dimensions: {
//     get: jest.fn(() => ({ width: 375, height: 812 })),
//   },
// }));

// // Mock específico para NativeEventEmitter
// jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
//   return jest.fn().mockImplementation(() => ({
//     addListener: jest.fn(),
//     removeListener: jest.fn(),
//   }));
// });

// jest.mock('react', () => {
//   const react = jest.requireActual('react');

//   return {
//     ...react,
//     useState: jest.fn(react.useState),
//     useEffect: jest.fn(react.useEffect),
//     useContext: jest.fn(react.useContext),
//   };
// });

jest.mock('@janiscommerce/app-request', () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => mockRequest),
}));


jest.mock('@janiscommerce/app-tracking-time', () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => mockTimeTracker),
}));
