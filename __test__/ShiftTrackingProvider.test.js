import React from 'react';
import {render, waitFor} from '@testing-library/react';
import ShiftTrackingProvider from '../lib/provider/ShiftTrackingProvider';
import {openShift, downloadWorkLogTypes} from '../lib/utils/provider';
import {mockMMKV} from '../__mocks__';
import ShiftTrackingContext from '../lib/context/ShiftTrackingContext';

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
	});

	it('should call openShift and downloadWorkLogTypes on mount', async () => {
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
		const onOpenShiftError = jest.fn();

		render(
			<ShiftTrackingProvider onOpenShiftError={onOpenShiftError}>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(openShift).toHaveBeenCalledTimes(1);
			expect(openShift).toHaveBeenCalledWith(onOpenShiftError);
			expect(downloadWorkLogTypes).toHaveBeenCalledTimes(1);
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
		// Configurar storage vacío
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
		});
	});
});
