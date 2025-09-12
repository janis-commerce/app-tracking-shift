import React from 'react';
import {render, waitFor} from '@testing-library/react';
import ShiftTrackingProvider from '../lib/provider/ShiftTrackingProvider';
import {
	openShift,
	downloadWorkLogTypes,
	isAuthorizedToUseStaffMS,
	getShiftWorkLogsFromJanis,
} from '../lib/utils/provider';
import {mockMMKV} from '../__mocks__';
import ShiftTrackingContext from '../lib/context/ShiftTrackingContext';
import * as Helpers from '../lib/utils/helpers';

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
				'staff.authorization': JSON.stringify({hasStaffAuthorization: true}),
			};
			return mockData[key] || null;
		});

		// Configurar promiseWrapper para retornar éxito por defecto
		jest.spyOn(Helpers, 'promiseWrapper').mockImplementation((promise) => {
			if (!promise || typeof promise.then !== 'function') {
				return Promise.resolve([undefined, null]);
			}
			return promise.then((data) => [data, null]).catch((error) => Promise.resolve([null, error]));
		});

		// Configurar mocks por defecto
		isAuthorizedToUseStaffMS.mockResolvedValue(true);
		openShift.mockResolvedValue({
			openShiftId: 'shift-123',
			getWorkLogs: false,
		});
		downloadWorkLogTypes.mockResolvedValue(undefined);
		getShiftWorkLogsFromJanis.mockResolvedValue({
			openWorkLogs: [],
			closedWorkLogs: [],
		});
	});

	describe('Staff Authorization Validation', () => {
		it('should not proceed with openShift and downloadWorkLogTypes when user is not authorized', async () => {
			isAuthorizedToUseStaffMS.mockResolvedValueOnce(false);

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
				expect(isAuthorizedToUseStaffMS).toHaveBeenCalledTimes(1);
				expect(openShift).not.toHaveBeenCalled();
				expect(downloadWorkLogTypes).not.toHaveBeenCalled();
				expect(contextValue.error).toBeNull();
			});
		});

		it('should set staffMSAuthorization error when authorization check fails', async () => {
			const authError = new Error('Authorization failed');
			isAuthorizedToUseStaffMS.mockRejectedValueOnce(authError);

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
				expect(isAuthorizedToUseStaffMS).toHaveBeenCalledTimes(1);
				expect(openShift).not.toHaveBeenCalled();
				expect(downloadWorkLogTypes).not.toHaveBeenCalled();
				expect(contextValue.error).toEqual({
					message: authError.message,
					type: 'staffMSAuthorization',
				});
			});
		});
		it('should handle authorization error and not proceed with subsequent operations', async () => {
			const authError = new Error('User not found in staff system');
			isAuthorizedToUseStaffMS.mockRejectedValueOnce(authError);

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
				expect(isAuthorizedToUseStaffMS).toHaveBeenCalledTimes(1);
				expect(openShift).not.toHaveBeenCalled();
				expect(downloadWorkLogTypes).not.toHaveBeenCalled();
				expect(contextValue.error.type).toBe('staffMSAuthorization');
			});
		});
	});

	it('should call openShift and downloadWorkLogTypes on mount', async () => {
		isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
		openShift.mockResolvedValueOnce({
			openShiftId: 'shift-456',
			getWorkLogs: false,
		});
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
		isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
		openShift.mockResolvedValueOnce({
			openShiftId: 'shift-456',
			getWorkLogs: false,
		});
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
		isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
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
		isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
		openShift.mockResolvedValueOnce({
			openShiftId: 'shift-456',
			getWorkLogs: false,
		});
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
		isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
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
		isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
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
		isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
		openShift.mockResolvedValueOnce({
			openShiftId: 'shift-456',
			getWorkLogs: false,
		});
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

	it('should handle openShift error and not continue with downloadWorkLogTypes', async () => {
		isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
		const openShiftError = new Error('Open shift failed');
		openShift.mockRejectedValueOnce(openShiftError);

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
		it('should call getShiftWorkLogsFromJanis when openShift returns getWorkLogs: true', async () => {
			isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
			openShift.mockResolvedValueOnce({
				openShiftId: 'shift-789',
				getWorkLogs: true,
			});
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);
			getShiftWorkLogsFromJanis.mockResolvedValueOnce({
				openWorkLogs: [],
				closedWorkLogs: [],
			});

			render(
				<ShiftTrackingProvider>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(getShiftWorkLogsFromJanis).toHaveBeenCalledTimes(1);
				expect(getShiftWorkLogsFromJanis).toHaveBeenCalledWith('shift-789');
			});
		});

		it('should NOT call getShiftWorkLogsFromJanis when openShift returns getWorkLogs: false', async () => {
			isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
			openShift.mockResolvedValueOnce({
				openShiftId: 'shift-789',
				getWorkLogs: false,
			});
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);

			render(
				<ShiftTrackingProvider>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(openShift).toHaveBeenCalledTimes(1);
				expect(downloadWorkLogTypes).toHaveBeenCalledTimes(1);
				expect(getShiftWorkLogsFromJanis).not.toHaveBeenCalled();
			});
		});

		it('should handle getShiftWorkLogsFromJanis error and set error state', async () => {
			const workLogsError = new Error('Failed to fetch work logs');
			isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
			openShift.mockResolvedValueOnce({
				openShiftId: 'shift-789',
				getWorkLogs: true,
			});
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);
			getShiftWorkLogsFromJanis.mockRejectedValueOnce(workLogsError);

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

		it('should set shift status to paused when there is an open workLog that is not excluded', async () => {
			const mockWorkLogs = {
				openWorkLogs: [
					{
						id: 'worklog-1',
						referenceId: 'regular-work',
						name: 'Regular Work',
						startDate: '2023-01-01T10:00:00Z',
						endDate: null,
					},
				],
				closedWorkLogs: [],
			};

			isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
			openShift.mockResolvedValueOnce({
				openShiftId: 'shift-789',
				getWorkLogs: true,
			});
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);
			getShiftWorkLogsFromJanis.mockResolvedValueOnce(mockWorkLogs);

			render(
				<ShiftTrackingProvider>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(mockMMKV.set).toHaveBeenCalledWith('shift.status', 'paused');
				expect(mockMMKV.set).toHaveBeenCalledWith('worklog.id', 'worklog-1');
				expect(mockMMKV.set).toHaveBeenCalledWith(
					'worklog.data',
					JSON.stringify(mockWorkLogs.openWorkLogs[0])
				);
			});
		});

		it('should NOT set shift status to paused when open workLog is excluded', async () => {
			const mockWorkLogs = {
				openWorkLogs: [
					{
						id: 'picking-worklog-1', // el id que se obtiene de janis es "worklog-1", pero se formatea al recibirlo para la base de datos
						referenceId: 'default-picking-work', // Esta es una excluded worklog type
						name: 'Picking Work',
						startDate: '2023-01-01T10:00:00Z',
						endDate: null,
					},
				],
				closedWorkLogs: [],
			};

			isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
			openShift.mockResolvedValueOnce({
				openShiftId: 'shift-789',
				getWorkLogs: true,
			});
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);
			getShiftWorkLogsFromJanis.mockResolvedValueOnce(mockWorkLogs);

			render(
				<ShiftTrackingProvider>
					<div>Test Child</div>
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				// Debe guardar el worklog data pero NO cambiar el status a paused
				expect(mockMMKV.set).toHaveBeenCalledWith('worklog.id', 'picking-worklog-1');
				expect(mockMMKV.set).toHaveBeenCalledWith(
					'worklog.data',
					JSON.stringify(mockWorkLogs.openWorkLogs[0])
				);
				expect(mockMMKV.set).not.toHaveBeenCalledWith('shift.status', 'paused');
			});
		});

		it('should call getShiftWorkLogsFromJanis only once per openShift execution', async () => {
			const mockWorkLogs = {
				openWorkLogs: [],
				closedWorkLogs: [],
			};

			isAuthorizedToUseStaffMS.mockResolvedValueOnce(true);
			openShift.mockResolvedValueOnce({
				openShiftId: 'shift-789',
				getWorkLogs: true,
			});
			downloadWorkLogTypes.mockResolvedValueOnce(undefined);
			getShiftWorkLogsFromJanis.mockResolvedValueOnce(mockWorkLogs);

			const TestComponent = () => {
				return <div data-testid="test-component">Test Component</div>;
			};

			render(
				<ShiftTrackingProvider>
					<TestComponent />
				</ShiftTrackingProvider>
			);

			await waitFor(() => {
				expect(getShiftWorkLogsFromJanis).toHaveBeenCalledTimes(1);
				expect(getShiftWorkLogsFromJanis).toHaveBeenCalledWith('shift-789');
			});

			// Verificar que el mock no fue llamado más veces
			expect(getShiftWorkLogsFromJanis).toHaveBeenCalledTimes(1);
		});
	});
});
