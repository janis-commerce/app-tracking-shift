import React from 'react';
import {render, waitFor} from '@testing-library/react';
import ShiftTrackingProvider from '../lib/provider/ShiftTrackingProvider';
import {downloadWorkLogTypes} from '../lib/provider/helpers';
import Storage from '../lib/db/StorageService';
import ShiftTrackingContext from '../lib/context/ShiftTrackingContext';
import Shift from '../lib/Shift';

jest.mock('../lib/provider/helpers', () => ({
	downloadWorkLogTypes: jest.fn(),
}));

describe('ShiftTrackingProvider', () => {
	const checkStaffMSAuthorizationSpy = jest.spyOn(Shift, 'checkStaffMSAuthorization');
	const openSpy = jest.spyOn(Shift, 'open');
	const refreshSpy = jest.spyOn(Shift, 'refreshWorkLogs');

	beforeEach(() => {
		jest.clearAllMocks();
		// Resetear los valores del mock storage
		Storage.get.mockImplementation((key) => {
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
				'staff.settings': JSON.stringify({enabledShiftAndWorkLog: true}),
			};
			return mockData[key] || null;
		});

		// Configurar mocks por defecto: Shift.open devuelve el mismo id que 'shift.id' en storage
		// (previousShiftId), por lo que getWorkLogs deriva en false por defecto.
		openSpy.mockResolvedValue('shift-123');
		downloadWorkLogTypes.mockResolvedValue(undefined);
		refreshSpy.mockResolvedValue({});
	});

	describe('Staff Authorization Validation', () => {
		it('should not proceed with openShift and downloadWorkLogTypes when user is not authorized', async () => {
			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: false},
			});
			checkStaffMSAuthorizationSpy.mockResolvedValueOnce(false);

			let contextValue;

			const TestComponent = () => {
				contextValue = React.useContext(ShiftTrackingContext);
				return <div data-testid="unauthorized-test">Not Authorized</div>;
			};

			const {getByTestId} = render(
				<ShiftTrackingProvider>
					<TestComponent />
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(getByTestId('unauthorized-test')).toBeDefined();
				expect(checkStaffMSAuthorizationSpy).toHaveBeenCalledTimes(1);
				expect(openSpy).not.toHaveBeenCalled();
				expect(downloadWorkLogTypes).not.toHaveBeenCalled();
				expect(contextValue.error).toBeNull();
			});
		});
		it('should set staffMSAuthorization error when authorization check fails', async () => {
			const authError = new Error('Authorization failed');
			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: false},
				isExpired: true,
				expirationTime: 0,
			});
			checkStaffMSAuthorizationSpy.mockRejectedValueOnce(authError);

			let contextValue;

			const TestComponent = () => {
				contextValue = React.useContext(ShiftTrackingContext);
				return (
					<div data-testid="auth-error-test">
						{contextValue?.error && (
							<span data-testid="auth-error">{contextValue.error.message}</span>
						)}
						{contextValue?.error && (
							<span data-testid="auth-error-type">{contextValue.error.type}</span>
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
				expect(getByTestId('auth-error')).toBeDefined();
				expect(getByTestId('auth-error-type')).toBeDefined();
				expect(checkStaffMSAuthorizationSpy).toHaveBeenCalledTimes(1);
				expect(openSpy).not.toHaveBeenCalled();
				expect(downloadWorkLogTypes).not.toHaveBeenCalled();
				expect(contextValue.error).toEqual({
					message: authError.message,
					type: 'staffMSAuthorization',
				});
			});
		});
		it('should handle authorization error and not proceed with subsequent operations', async () => {
			const authError = new Error('User not found in staff system');
			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: false},
				isExpired: true,
				expirationTime: 0,
			});
			checkStaffMSAuthorizationSpy.mockRejectedValueOnce(authError);

			let contextValue;

			const TestComponent = () => {
				contextValue = React.useContext(ShiftTrackingContext);
				return <div data-testid="no-proceed-test">Test</div>;
			};

			render(
				<ShiftTrackingProvider>
					<TestComponent />
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(checkStaffMSAuthorizationSpy).toHaveBeenCalledTimes(1);
				expect(openSpy).not.toHaveBeenCalled();
				expect(downloadWorkLogTypes).not.toHaveBeenCalled();
				expect(contextValue.error.type).toBe('staffMSAuthorization');
			});
		});
	});

	it('should call openShift and downloadWorkLogTypes on mount', async () => {
		Storage.get.mockReturnValueOnce({
			settings: {enabledShiftAndWorkLog: true},
			isExpired: false,
			expirationTime: Date.now() + 1000,
		});
		checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
		openSpy.mockResolvedValueOnce('shift-123');
		downloadWorkLogTypes.mockResolvedValueOnce(undefined);

		render(
			<ShiftTrackingProvider>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(openSpy).toHaveBeenCalledTimes(1);
			expect(openSpy).toHaveBeenCalledWith({warehouseId: ''});
			expect(downloadWorkLogTypes).toHaveBeenCalledTimes(1);
		});
	});

	it('should call openShift with error callback when provided', async () => {
		const onError = jest.fn();
		Storage.get.mockReturnValueOnce({
			settings: {enabledShiftAndWorkLog: true},
			isExpired: false,
			expirationTime: Date.now() + 1000,
		});
		checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
		openSpy.mockResolvedValueOnce('shift-123');
		downloadWorkLogTypes.mockResolvedValueOnce(undefined);

		render(
			<ShiftTrackingProvider onError={onError}>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(openSpy).toHaveBeenCalledTimes(1);
			expect(openSpy).toHaveBeenCalledWith({warehouseId: ''});
			expect(downloadWorkLogTypes).toHaveBeenCalledTimes(1);
			expect(downloadWorkLogTypes).toHaveBeenCalledWith(onError);
		});
	});

	it('should handle openShift error and set error state', async () => {
		const openShiftError = new Error('Failed to open shift');
		Storage.get.mockReturnValueOnce({
			settings: {enabledShiftAndWorkLog: true},
			isExpired: false,
			expirationTime: Date.now() + 1000,
		});
		checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
		openSpy.mockRejectedValueOnce(openShiftError);

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

	it('should invoke onError callback when Shift.open fails', async () => {
		const onError = jest.fn();
		const openShiftError = new Error('Failed to open shift');
		Storage.get.mockReturnValueOnce({
			settings: {enabledShiftAndWorkLog: true},
			isExpired: false,
			expirationTime: Date.now() + 1000,
		});
		checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
		openSpy.mockRejectedValueOnce(openShiftError);

		render(
			<ShiftTrackingProvider onError={onError}>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(onError).toHaveBeenCalledWith(openShiftError);
		});
	});

	it('should handle downloadWorkLogTypes error and set error state', async () => {
		const downloadError = new Error('Failed to download worklog types');
		Storage.get.mockReturnValueOnce({
			settings: {enabledShiftAndWorkLog: true},
			isExpired: false,
			expirationTime: Date.now() + 1000,
		});
		checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
		openSpy.mockResolvedValueOnce('shift-123');
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
		Storage.get.mockReturnValueOnce({
			settings: {enabledShiftAndWorkLog: true},
			isExpired: false,
			expirationTime: Date.now() + 1000,
		});
		checkStaffMSAuthorizationSpy.mockResolvedValueOnce();
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

	it('should render children normally', async () => {
		Storage.get.mockReturnValueOnce({
			settings: {enabledShiftAndWorkLog: true},
			isExpired: false,
			expirationTime: Date.now() + 1000,
		});
		checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
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
		checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
		// Configurar storage vacío para todas las llamadas
		Storage.get.mockReturnValue(null);

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
			expect(contextValue.shiftId).toBe(null);
			expect(contextValue.shiftStatus).toBe(null);
			expect(contextValue.workLogTypes).toEqual([]);
			expect(contextValue.error).toBeNull();
		});
	});

	it('should execute handleShiftTrackingInit successfully without errors', async () => {
		Storage.get.mockReturnValueOnce({
			settings: {enabledShiftAndWorkLog: true},
			isExpired: false,
			expirationTime: Date.now() + 1000,
		});
		checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
		openSpy.mockResolvedValueOnce('shift-123');
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
			expect(openSpy).toHaveBeenCalledTimes(1);
			expect(downloadWorkLogTypes).toHaveBeenCalledTimes(1);
		});
	});

	it('should handle openShift error and not continue with downloadWorkLogTypes', async () => {
		Storage.get.mockReturnValueOnce({
			settings: {enabledShiftAndWorkLog: true},
			isExpired: false,
			expirationTime: Date.now() + 1000,
		});
		checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
		const openShiftError = new Error('Open shift failed');
		openSpy.mockRejectedValueOnce(openShiftError);

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

	describe('WorkLogs History Functionality', () => {
		it('should call refreshWorkLogs when the shift identity changed (getWorkLogs: true)', async () => {
			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: true},
				isExpired: false,
				expirationTime: Date.now() + 1000,
			});
			checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);

			openSpy.mockResolvedValueOnce('shift-789');
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);
			refreshSpy.mockResolvedValueOnce({});

			render(
				<ShiftTrackingProvider>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(refreshSpy).toHaveBeenCalledTimes(1);
			});
		});

		it('should NOT call refreshWorkLogs when the shift is reused (getWorkLogs: false)', async () => {
			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: true},
				isExpired: false,
				expirationTime: Date.now() + 1000,
			});
			checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);

			openSpy.mockResolvedValueOnce('shift-123');
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);

			render(
				<ShiftTrackingProvider>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(openSpy).toHaveBeenCalledTimes(1);
				expect(downloadWorkLogTypes).toHaveBeenCalledTimes(1);
				expect(refreshSpy).not.toHaveBeenCalled();
			});
		});

		it('should handle refreshWorkLogs error and set error state', async () => {
			const workLogsError = new Error('Failed to fetch work logs');
			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: true},
				isExpired: false,
				expirationTime: Date.now() + 1000,
			});
			checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);

			openSpy.mockResolvedValueOnce('shift-789');
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);
			refreshSpy.mockRejectedValueOnce(workLogsError);

			let contextValue;

			const TestComponent = () => {
				contextValue = React.useContext(ShiftTrackingContext);
				return (
					<div data-testid="test-component">
						{contextValue?.error && <span data-testid="error">{contextValue.error.message}</span>}
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
				expect(getByTestId('error')).toBeDefined();
				expect(getByTestId('error-type')).toBeDefined();
				expect(contextValue.error).toEqual({
					message: workLogsError.message,
					type: 'getWorkLogsFromJanis',
				});
			});
		});

		it('should call refreshWorkLogs only once per open execution', async () => {
			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: true},
				isExpired: false,
				expirationTime: Date.now() + 1000,
			});
			checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);

			openSpy.mockResolvedValueOnce('shift-789');
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);
			refreshSpy.mockResolvedValueOnce({});

			render(
				<ShiftTrackingProvider>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(refreshSpy).toHaveBeenCalledTimes(1);
			});

			expect(refreshSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('Shift initialization flag', () => {
		it('should expose isShiftInitializationDone as false on the initial render and true after init completes', async () => {
			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: true},
				isExpired: false,
				expirationTime: Date.now() + 1000,
			});
			checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
			openSpy.mockResolvedValueOnce('shift-123');
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);

			let firstInitializedValue;
			let contextValue;

			const TestComponent = () => {
				contextValue = React.useContext(ShiftTrackingContext);
				if (firstInitializedValue === undefined) {
					firstInitializedValue = contextValue.isShiftInitializationDone;
				}
				return <div data-testid="init-flag-test" />;
			};

			render(
				<ShiftTrackingProvider>
					<TestComponent />
				</ShiftTrackingProvider>
			);

			expect(firstInitializedValue).toBe(false);

			await waitFor(() => {
				expect(contextValue.isShiftInitializationDone).toBe(true);
			});
		});

		it('should set isShiftInitializationDone to true even when the user is not authorized', async () => {
			checkStaffMSAuthorizationSpy.mockResolvedValueOnce(false);

			let contextValue;

			const TestComponent = () => {
				contextValue = React.useContext(ShiftTrackingContext);
				return <div data-testid="init-unauth-test" />;
			};

			render(
				<ShiftTrackingProvider>
					<TestComponent />
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(contextValue.isShiftInitializationDone).toBe(true);
				expect(openSpy).not.toHaveBeenCalled();
			});
		});

		it('should set isShiftInitializationDone to true when Shift.open fails', async () => {
			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: true},
				isExpired: false,
				expirationTime: Date.now() + 1000,
			});
			checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);
			openSpy.mockRejectedValueOnce(new Error('Open shift failed'));

			let contextValue;

			const TestComponent = () => {
				contextValue = React.useContext(ShiftTrackingContext);
				return <div data-testid="init-openerror-test" />;
			};

			render(
				<ShiftTrackingProvider>
					<TestComponent />
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(contextValue.isShiftInitializationDone).toBe(true);
				expect(contextValue.error.type).toBe('openShift');
			});
		});
	});

	describe('Warehouse Change Functionality', () => {
		it('should call Shift.update when warehouseId changes and shift is open', async () => {
			const initialWarehouseId = 'warehouse-1';
			const newWarehouseId = 'warehouse-2';

			jest.spyOn(Shift, 'update').mockResolvedValueOnce('shift-123');
			Object.defineProperty(Shift, 'isOpen', {
				get: jest.fn(() => true),
				configurable: true,
			});

			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: true},
				isExpired: false,
				expirationTime: Date.now() + 1000,
			});
			checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);

			openSpy.mockResolvedValueOnce('shift-123');
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);

			const {rerender} = render(
				<ShiftTrackingProvider additionalInfo={{warehouseId: initialWarehouseId}}>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(openSpy).toHaveBeenCalledWith({
					warehouseId: initialWarehouseId,
				});
			});

			// Cambiar el warehouseId
			rerender(
				<ShiftTrackingProvider additionalInfo={{warehouseId: newWarehouseId}}>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(Shift.update).toHaveBeenCalledWith({warehouseId: newWarehouseId});
			});
		});

		it('should not call Shift.update when warehouseId changes but shift is not open', async () => {
			const initialWarehouseId = 'warehouse-1';
			const newWarehouseId = 'warehouse-2';

			jest.spyOn(Shift, 'update').mockResolvedValueOnce('shift-123');
			Object.defineProperty(Shift, 'isOpen', {
				get: jest.fn(() => false),
				configurable: true,
			});

			Storage.get.mockReturnValueOnce({
				settings: {enabledShiftAndWorkLog: true},
				isExpired: false,
				expirationTime: Date.now() + 1000,
			});
			checkStaffMSAuthorizationSpy.mockResolvedValueOnce(true);

			openSpy.mockResolvedValueOnce('shift-123');
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);

			const {rerender} = render(
				<ShiftTrackingProvider additionalInfo={{warehouseId: initialWarehouseId}}>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(openSpy).toHaveBeenCalled();
			});

			// Cambiar el warehouseId
			rerender(
				<ShiftTrackingProvider additionalInfo={{warehouseId: newWarehouseId}}>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			// Esperar un poco para asegurarnos que no se llamó
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(Shift.update).not.toHaveBeenCalled();
		});
	});
});
