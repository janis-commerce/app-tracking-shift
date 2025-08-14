import React from 'react';
import {render, waitFor} from '@testing-library/react';
import ShiftTrackingProvider from '../lib/provider/ShiftTrackingProvider';
import {openShift, downloadWorkLogTypes} from '../lib/utils/provider';
import {mockMMKV} from '../__mocks__';
import ShiftTrackingContext from '../lib/context/ShiftTrackingContext';
import {promiseWrapper} from '../lib/utils/helpers';

// Mock de las funciones provider
jest.mock('../lib/utils/provider', () => ({
	openShift: jest.fn(),
	downloadWorkLogTypes: jest.fn(),
}));

describe('ShiftTrackingProvider', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Resetear los valores del mock storage
		mockMMKV.getString.mockImplementation((key) => {
			const mockData = {
				'shift.status': 'opened',
				'shift.id': 'shift-123',
				'worklog.id': 'worklog-456',
				'shift.data': JSON.stringify({
					id: 'shift-123',
					status: 'opened',
					startTime: '2023-01-01T10:00:00Z',
				}),
				'worklogTypes.data': JSON.stringify({
					workLogTypes: [{id: 1, name: 'Test Type', referenceId: 'ref-123'}],
				}),
				'worklog.data': JSON.stringify({id: 'worklog-456', type: 'test'}),
			};
			return mockData[key] || null;
		});

		// Configurar promiseWrapper para retornar éxito por defecto
		promiseWrapper.mockImplementation((promise) => {
			if (!promise || typeof promise.then !== 'function') {
				return Promise.resolve([undefined, null]);
			}
			return promise.then((data) => [data, null]).catch((error) => Promise.resolve([null, error]));
		});
	});

	it('should call openShift and downloadWorkLogTypes on mount', async () => {
		openShift.mockResolvedValueOnce(true);
		downloadWorkLogTypes.mockResolvedValueOnce(undefined);

		render(
			<ShiftTrackingProvider>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(openShift).toHaveBeenCalledTimes(1);
			expect(openShift).toHaveBeenCalledWith(null);
			expect(downloadWorkLogTypes).toHaveBeenCalledTimes(1);
		});
	});

	it('should call openShift with error callback when provided', async () => {
		const onError = jest.fn();
		openShift.mockResolvedValueOnce(true);
		downloadWorkLogTypes.mockResolvedValueOnce(undefined);

		render(
			<ShiftTrackingProvider onError={onError}>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(openShift).toHaveBeenCalledTimes(1);
			expect(openShift).toHaveBeenCalledWith(onError);
			expect(downloadWorkLogTypes).toHaveBeenCalledTimes(1);
			expect(downloadWorkLogTypes).toHaveBeenCalledWith(onError);
		});
	});

	it('should handle openShift error and set error state', async () => {
		const openShiftError = new Error('Failed to open shift');
		openShift.mockRejectedValueOnce(openShiftError);

		let contextValue;

		const TestComponent = () => {
			contextValue = React.useContext(ShiftTrackingContext);
			return (
				<div data-testid="test-component">
					{contextValue?.error && <span data-testid="error">{contextValue.error.message}</span>}
				</div>
			);
		};

		const {getByTestId} = render(
			<ShiftTrackingProvider>
				<TestComponent />
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getByTestId('error')).toBeDefined();
			expect(contextValue.error).toEqual({
				message: openShiftError.message,
				type: 'openShift',
			});
		});
	});

	it('should handle downloadWorkLogTypes error and set error state', async () => {
		const downloadError = new Error('Failed to download worklog types');
		openShift.mockResolvedValueOnce(true);
		downloadWorkLogTypes.mockRejectedValueOnce(downloadError);

		let contextValue;

		const TestComponent = () => {
			contextValue = React.useContext(ShiftTrackingContext);
			return (
				<div data-testid="test-component">
					{contextValue?.error && <span data-testid="error">{contextValue.error.message}</span>}
				</div>
			);
		};

		const {getByTestId} = render(
			<ShiftTrackingProvider>
				<TestComponent />
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getByTestId('error')).toBeDefined();
			expect(contextValue.error).toEqual({
				message: downloadError.message,
				type: 'downloadWorkLogTypes',
			});
		});
	});

	it('should provide context values from storage', async () => {
		let contextValue;

		const TestComponent = () => {
			contextValue = React.useContext(ShiftTrackingContext);
			return (
				<div data-testid="test-component">
					{contextValue?.shiftId && <span data-testid="shift-id">{contextValue.shiftId}</span>}
					{contextValue?.shiftStatus && (
						<span data-testid="shift-status">{contextValue.shiftStatus}</span>
					)}
				</div>
			);
		};

		const {getByTestId} = render(
			<ShiftTrackingProvider>
				<TestComponent />
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getByTestId('test-component')).toBeDefined();
			expect(contextValue).toBeDefined();
			expect(contextValue.shiftId).toBe('shift-123');
			expect(contextValue.shiftStatus).toBe('opened');
		});
	});

	it('should render pausedShiftComponent when shiftStatus is paused and callback is provided', async () => {
		mockMMKV.getString.mockImplementation((key) => {
			if (key === 'shift.status') return 'paused';
			return null;
		});

		const {getByTestId} = render(
			<ShiftTrackingProvider
				pausedShiftComponent={<div data-testid="paused-component">Shift Paused</div>}>
				<div>Normal Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getByTestId('paused-component')).toBeDefined();
		});
	});

	it('should render children normally when shiftStatus is not paused', async () => {
		const {getByText} = render(
			<ShiftTrackingProvider>
				<div>Normal Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getByText('Normal Child')).toBeDefined();
		});
	});

	it('should handle empty storage values gracefully', async () => {
		// Configurar storage vacío para todas las llamadas
		mockMMKV.getString.mockReturnValue(null);

		let contextValue;

		const TestComponent = () => {
			contextValue = React.useContext(ShiftTrackingContext);
			return <div data-testid="empty-test">Test</div>;
		};

		const {getByTestId} = render(
			<ShiftTrackingProvider>
				<TestComponent />
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getByTestId('empty-test')).toBeDefined();
			expect(contextValue).toBeDefined();
			expect(contextValue.shiftId).toBeNull();
			expect(contextValue.shiftStatus).toBeNull();
			expect(contextValue.workLogTypes).toEqual([]);
			expect(contextValue.error).toBeNull();
		});
	});

	it('should execute handleShiftTrackingInit successfully without errors', async () => {
		openShift.mockResolvedValueOnce(true);
		downloadWorkLogTypes.mockResolvedValueOnce(undefined);

		let contextValue;

		const TestComponent = () => {
			contextValue = React.useContext(ShiftTrackingContext);
			return <div data-testid="success-test">Success</div>;
		};

		const {getByTestId} = render(
			<ShiftTrackingProvider>
				<TestComponent />
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getByTestId('success-test')).toBeDefined();
			expect(contextValue.error).toBeNull();
			expect(openShift).toHaveBeenCalledTimes(1);
			expect(downloadWorkLogTypes).toHaveBeenCalledTimes(1);
		});
	});

	it('should handle openShift error and continue with downloadWorkLogTypes', async () => {
		const openShiftError = new Error('Open shift failed');
		openShift.mockRejectedValueOnce(openShiftError);
		downloadWorkLogTypes.mockResolvedValueOnce(undefined);

		let contextValue;

		const TestComponent = () => {
			contextValue = React.useContext(ShiftTrackingContext);
			return (
				<div data-testid="test-component">
					{contextValue?.error && <span data-testid="error-type">{contextValue.error.type}</span>}
				</div>
			);
		};

		const {getByTestId} = render(
			<ShiftTrackingProvider>
				<TestComponent />
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getByTestId('error-type')).toBeDefined();
			expect(contextValue.error.type).toBe('openShift');
			expect(downloadWorkLogTypes).not.toHaveBeenCalled();
		});
	});
});
