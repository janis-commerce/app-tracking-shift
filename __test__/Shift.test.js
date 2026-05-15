import * as deviceInfo from '@janiscommerce/app-device-info';
import {worklogTypes, parsedWorklogTypes} from '../__mocks__/worklogTypes';
import {
	mockCrashlytics,
	mockShiftData,
	mockWorkLogs,
	mockWorkLogsRaw,
	mockOfflineData,
	mockPendingWorkLogs,
	mockFormattedOfflineWorkLogs,
} from '../__mocks__';
import StaffService from '../lib/StaffApiServices';
import {
	SHIFT_STATUS,
	SHIFT_ID,
	SHIFT_DATA,
	CURRENT_WORKLOG_ID,
	CURRENT_WORKLOG_DATA,
	EXCLUDED_WORKLOG_TYPES,
	WORKLOG_TYPES_DATA,
} from '../lib/constant';
import Storage from '../lib/db/StorageService';
import ShiftWorklogs from '../lib/ShiftWorklogs';
import Formatter from '../lib/Formatter';
import Shift from '../lib/Shift';
import OfflineData from '../lib/OfflineData';
import ShiftInactivity from '../lib/ShiftInactivity';

// Mock para Date
const mockDate = new Date('2024-01-15T10:30:00.000Z');
const RealDate = Date;

const spyIsInternetReachable = jest.spyOn(deviceInfo, 'getInternetReachability');

const spyHasAuthorization = (authorization) =>
	jest
		.spyOn(Object.getPrototypeOf(Shift), 'hasStaffAuthorization', 'get')
		.mockReturnValue(authorization);

describe('Shift', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks(); // Restaura todos los spies para evitar interferencias

		// Restaurar comportamiento por defecto de OfflineData
		mockOfflineData.save.mockImplementation(() => {});
		mockOfflineData.get.mockReturnValue([]);
		mockOfflineData.delete.mockImplementation(() => {});
		mockOfflineData.deleteAll.mockImplementation(() => {});
		mockOfflineData.hasData = false;

		// Resetear mocks completamente para evitar interferencias
		Storage.get.mockReset();

		spyHasAuthorization(true);

		// Mock de Date simplificado
		global.Date = jest.fn((dateString) => {
			return dateString ? new RealDate(dateString) : mockDate;
		});
		global.Date.prototype = RealDate.prototype;
		global.Date.now = jest.fn(() => mockDate.getTime());
		global.Date.toISOString = jest.fn(() => mockDate.toISOString());
	});

	afterEach(() => {
		global.Date = RealDate;
	});

	describe('hasInactivityDetectionEnabled', () => {
		it('should return true when inactivity timeout is greater than 0', () => {
			Storage.get.mockReturnValueOnce({settings: {inactivityTimeout: 1000}});
			expect(Shift.hasInactivityDetectionEnabled).toBe(true);
		});
		it('should return false when inactivity timeout is 0', () => {
			Storage.get.mockReturnValueOnce({settings: {inactivityTimeout: 0}});
			expect(Shift.hasInactivityDetectionEnabled).toBe(false);
		});
		it('should return false when inactivity timeout is not set', () => {
			Storage.get.mockReturnValueOnce({});
			expect(Shift.hasInactivityDetectionEnabled).toBe(false);
		});
	});
	describe('open', () => {
		it('should throw error when user does not have staff authorization', async () => {
			spyHasAuthorization(false);

			await expect(Shift.open()).rejects.toThrow('Staff MS authorization is required');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});
		it('should start a shift with specific date', async () => {
			const mockShiftId = 'shift-456';
			const specificDate = '2024-01-15T10:00:00.000Z';
			const mockOpenShift = {id: mockShiftId, startDate: '2024-01-15T09:00:00.000Z'};

			StaffService.openShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [mockOpenShift],
			});

			const result = await Shift.open({date: specificDate});

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_ID, mockShiftId);
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'opened');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('API Error');
			StaffService.openShift.mockRejectedValueOnce(error);

			await expect(Shift.open()).rejects.toThrow('API Error');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should start a shift successfully even with minimal data', async () => {
			const mockShiftId = 'shift-789';
			const mockOpenShift = {id: mockShiftId, startDate: '2024-01-15T10:00:00.000Z'};

			StaffService.openShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [mockOpenShift],
			});

			const result = await Shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should handle response without result', async () => {
			StaffService.openShift.mockResolvedValueOnce({});
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [],
			});

			const result = await Shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(result).toBe('');
		});

		it('should handle response with result but without id', async () => {
			StaffService.openShift.mockResolvedValueOnce({result: {}});
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [],
			});

			const result = await Shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(result).toBe('');
		});
	});

	describe('update', () => {
		it('should throw error when user does not have staff authorization', async () => {
			spyHasAuthorization(false);

			await expect(Shift.update({warehouseId: 'warehouse-123'})).rejects.toThrow(
				'Staff MS authorization is required'
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should reopen and retry when updateShift fails with closed shift error', async () => {
			const mockShiftId = 'shift-789';
			const closedShiftError = {
				result: {message: 'No opened shift found for user 123'},
				statusCode: 404,
			};
			const reOpenSpy = jest.spyOn(Shift, 'reOpen').mockResolvedValueOnce(null);

			Storage.get.mockReturnValueOnce({warehouseId: 'warehouse-old'});
			Storage.get.mockReturnValueOnce({warehouseId: 'warehouse-old'});
			StaffService.updateShift
				.mockRejectedValueOnce(closedShiftError)
				.mockResolvedValueOnce({result: {id: mockShiftId}});

			const result = await Shift.update({warehouseId: 'warehouse-new'});

			expect(reOpenSpy).toHaveBeenCalled();
			expect(StaffService.updateShift).toHaveBeenCalledTimes(2);
			expect(result).toBe(mockShiftId);
			reOpenSpy.mockRestore();
		});

		it('should return shift id when warehouseId has not changed', async () => {
			Storage.get.mockReturnValueOnce({warehouseId: 'warehouse-123'});
			Storage.get.mockReturnValueOnce('shift-456');

			const result = await Shift.update({warehouseId: 'warehouse-123'});

			expect(result).toBe('shift-456');
			expect(StaffService.updateShift).not.toHaveBeenCalled();
		});

		it('should update shift successfully with new warehouseId', async () => {
			const mockShiftId = 'shift-789';
			const newWarehouseId = 'warehouse-456';

			Storage.get.mockReturnValueOnce({warehouseId: 'warehouse-123'});
			Storage.get.mockReturnValueOnce({warehouseId: 'warehouse-123'});

			StaffService.updateShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});

			const result = await Shift.update({warehouseId: newWarehouseId});

			expect(mockCrashlytics.log).toHaveBeenCalledWith('[updateShift]:');
			expect(StaffService.updateShift).toHaveBeenCalledWith({warehouseId: newWarehouseId});
			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				expect.objectContaining({warehouseId: newWarehouseId})
			);
			expect(result).toBe(mockShiftId);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('Update failed');

			Storage.get.mockReturnValueOnce({warehouseId: 'warehouse-123'});
			Storage.get.mockReturnValueOnce({warehouseId: 'warehouse-123'});
			StaffService.updateShift.mockRejectedValueOnce(error);

			await expect(Shift.update({warehouseId: 'warehouse-456'})).rejects.toThrow('Update failed');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});
	});

	describe('finish', () => {
		it('should throw error when user does not have staff authorization', async () => {
			spyHasAuthorization(false);

			await expect(Shift.finish()).rejects.toThrow('Staff MS authorization is required');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should finish a shift successfully and send pending worklogs', async () => {
			const mockShiftId = 'shift-999';

			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			mockOfflineData.deleteAll.mockImplementation(() => {});

			ShiftWorklogs.formatForJanis.mockReturnValueOnce(mockFormattedOfflineWorkLogs);

			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			Storage.get.mockReturnValueOnce(mockShiftData);

			const result = await Shift.finish();

			expect(mockOfflineData.get).toHaveBeenCalled();
			expect(ShiftWorklogs.formatForJanis).toHaveBeenCalledWith(mockPendingWorkLogs);
			expect(ShiftWorklogs.batch).toHaveBeenCalledWith(mockFormattedOfflineWorkLogs);
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();

			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				expect.objectContaining({endDate: mockDate.toISOString()})
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should finish a shift successfully without pending worklogs', async () => {
			const mockShiftId = 'shift-998';

			mockOfflineData.hasData = false;

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			Storage.get.mockReturnValueOnce(mockShiftData);

			const result = await Shift.finish();

			expect(mockOfflineData.get).not.toHaveBeenCalled();
			expect(Formatter.formatOfflineWorkLog).not.toHaveBeenCalled();
			expect(ShiftWorklogs.batch).not.toHaveBeenCalled();

			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				expect.objectContaining({endDate: mockDate.toISOString()})
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should reopen a shift if closeShift fails with closed shift error', async () => {
			const mockShiftId = 'shift-999';
			const closedShiftError = {
				result: {message: 'No opened shift found for user 123'},
				statusCode: 404,
			};
			const reOpenSpy = jest.spyOn(Shift, 'reOpen').mockResolvedValueOnce(null);

			mockOfflineData.hasData = false;
			Storage.get.mockReturnValue(mockShiftData);

			StaffService.closeShift
				.mockRejectedValueOnce(closedShiftError)
				.mockResolvedValueOnce({result: {id: mockShiftId}});

			const result = await Shift.finish();

			expect(reOpenSpy).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalledTimes(2);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
			reOpenSpy.mockRestore();
		});

		it('should finish a shift with specific date', async () => {
			const mockShiftId = 'shift-888';
			const specificDate = '2024-01-15T18:00:00.000Z';

			mockOfflineData.hasData = false;

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			Storage.get.mockReturnValueOnce(mockShiftData);

			const result = await Shift.finish({date: specificDate});

			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				expect.objectContaining({endDate: specificDate})
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should handle response with result but without id', async () => {
			const specificDate = '2024-01-15T18:00:00.000Z';

			mockOfflineData.hasData = false;

			StaffService.closeShift.mockResolvedValueOnce({
				result: undefined,
			});
			Storage.get.mockReturnValueOnce(mockShiftData);

			const result = await Shift.finish({date: specificDate});

			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				expect.objectContaining({endDate: specificDate})
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(result).toBe('');
		});

		it('should handle staff service errors', async () => {
			const error = new Error('Close shift failed');
			mockOfflineData.hasData = false;
			Storage.get.mockReturnValueOnce(mockShiftData);

			StaffService.closeShift.mockRejectedValueOnce(error);

			await expect(Shift.finish()).rejects.toThrow('Close shift failed');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should finish a shift successfully with minimal data', async () => {
			const mockShiftId = 'shift-777';

			mockOfflineData.hasData = false;

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			Storage.get.mockReturnValueOnce(mockShiftData);

			const result = await Shift.finish();

			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				expect.objectContaining({endDate: mockDate.toISOString()})
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});
	});

	describe('getUserOpenShift', () => {
		it('should throw error when user does not have staff authorization', async () => {
			spyHasAuthorization(false);

			await expect(Shift.getUserOpenShift()).rejects.toThrow('Staff MS authorization is required');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should get user open shift successfully', async () => {
			const mockShift = {id: 'shift-123', status: 'opened'};
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [mockShift],
			});

			const result = await Shift.getUserOpenShift({userId: 'user-123', id: 'shift-123'});

			expect(mockCrashlytics.log).toHaveBeenCalledWith('getUserOpenShift:', {
				userId: 'user-123',
				id: 'shift-123',
			});
			expect(StaffService.getShiftsList).toHaveBeenCalledWith({
				filters: {
					userId: 'user-123',
					status: 'opened',
					id: 'shift-123',
				},
			});
			expect(result).toEqual(mockShift);
		});

		it('should return empty object when no open shift found', async () => {
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: undefined,
			});

			const result = await Shift.getUserOpenShift();

			expect(result).toEqual({});
		});

		it('should handle staff service errors', async () => {
			const error = new Error('Get shifts list failed');
			StaffService.getShiftsList.mockRejectedValueOnce(error);

			await expect(Shift.getUserOpenShift({userId: 'user-123'})).rejects.toThrow(error);
		});
	});

	describe('fetchWorklogTypes', () => {
		it('should throw error when user does not have staff authorization', async () => {
			spyHasAuthorization(false);

			await expect(Shift.fetchWorklogTypes()).rejects.toThrow('Staff MS authorization is required');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should fetch worklog types successfully', async () => {
			StaffService.getWorkLogTypes.mockResolvedValueOnce({
				result: worklogTypes,
			});
			Formatter.formatWorkLogTypes.mockReturnValueOnce(parsedWorklogTypes);

			const result = await Shift.fetchWorklogTypes();

			expect(StaffService.getWorkLogTypes).toHaveBeenCalled();
			expect(Formatter.formatWorkLogTypes).toHaveBeenCalledWith(worklogTypes);
			expect(result).toEqual(parsedWorklogTypes);
		});

		it('should handle empty worklog types response', async () => {
			StaffService.getWorkLogTypes.mockResolvedValueOnce({
				result: undefined,
			});
			Formatter.formatWorkLogTypes.mockReturnValueOnce([]);

			const result = await Shift.fetchWorklogTypes();

			expect(Formatter.formatWorkLogTypes).toHaveBeenCalledWith([]);
			expect(result).toEqual([]);
		});

		it('should filter out worklog types without id or referenceId', async () => {
			const mockWorklogTypes = [
				...worklogTypes,
				{
					id: 'type-4',
					referenceId: 'ref-4',
					name: 'Trabajo Mínimo',
				},
			];

			const expectedFiltered = [
				...parsedWorklogTypes,
				{
					id: 'type-4',
					referenceId: 'ref-4',
					name: 'Trabajo Mínimo',
					type: '',
					description: '',
					suggestedTime: 0,
				},
			];

			StaffService.getWorkLogTypes.mockResolvedValueOnce({
				result: mockWorklogTypes,
			});
			Formatter.formatWorkLogTypes.mockReturnValueOnce(expectedFiltered);

			const result = await Shift.fetchWorklogTypes();

			expect(Formatter.formatWorkLogTypes).toHaveBeenCalledWith(mockWorklogTypes);
			expect(result).toEqual(expectedFiltered);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('API Error');
			StaffService.getWorkLogTypes.mockRejectedValueOnce(error);

			await expect(Shift.fetchWorklogTypes()).rejects.toThrow('API Error');
		});
	});

	describe('deleteShiftRegisters', () => {
		it('should delete all registers successfully', async () => {
			mockOfflineData.deleteAll.mockReturnValueOnce(true);

			const result = await Shift.deleteShiftRegisters();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('deleteShiftRegisters:');
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();
			expect(result).toBe(true);
		});

		it('should handle OfflineData errors', async () => {
			const error = new Error('Delete failed');
			mockOfflineData.deleteAll.mockImplementation(() => {
				throw error;
			});

			await expect(Shift.deleteShiftRegisters()).rejects.toThrow('Delete failed');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});
	});

	describe('current worklog helpers', () => {
		it('getCurrentWorkLog should return merged id and data when present', () => {
			const mockId = 'wl-123';
			const mockData = {referenceId: 'ref-1', startDate: mockDate.toISOString()};
			Storage.get
				.mockReturnValueOnce(mockId) // CURRENT_WORKLOG_ID
				.mockReturnValueOnce(mockData); // CURRENT_WORKLOG_DATA

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			const result = Shift.getCurrentWorkLog();

			expect(result).toEqual({id: mockId, ...mockData});
		});

		it('getCurrentWorkLog should return empty object when no data', () => {
			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);

			const result = Shift.getCurrentWorkLog();

			expect(result).toEqual({});
		});

		it('setCurrentWorkLog should persist id and enriched data with shiftId and suggestedFinishDate', () => {
			const shiftId = 'shift-abc';
			const startDate = mockDate.toISOString(); // 2024-01-15T10:30:00.000Z
			const workLog = {
				id: 'wl-999',
				referenceId: 'ref-xyz',
				startDate,
				suggestedTime: 15,
			};
			// this.id lee de Storage.get(SHIFT_ID)
			Storage.get.mockReturnValueOnce(shiftId);

			Shift.setCurrentWorkLog(workLog);

			expect(Storage.set).toHaveBeenCalledWith(CURRENT_WORKLOG_ID, workLog.id);
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.objectContaining({
					...workLog,
					shiftId,
					suggestedFinishDate: new Date(
						new Date(startDate).getTime() + 15 * 60 * 1000
					).toISOString(),
				})
			);
		});

		it('deleteCurrentWorkLog should remove id and data', () => {
			Shift.deleteCurrentWorkLog();
			expect(Storage.remove).toHaveBeenCalledWith(CURRENT_WORKLOG_ID);
			expect(Storage.remove).toHaveBeenCalledWith(CURRENT_WORKLOG_DATA);
		});
	});

	describe('openWorkLog', () => {
		it('should return null when no arguments are passed to openWorkLog', async () => {
			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(false);

			await expect(Shift.openWorkLog()).rejects.toThrow(
				'must provide a valid activity to open a work log'
			);
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should throw error when user does not have staff authorization', async () => {
			spyHasAuthorization(false);

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			await expect(Shift.openWorkLog({referenceId: 'test'})).rejects.toThrow(
				'Staff MS authorization is required'
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should open worklog successfully and pause shift for normal activities', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				suggestedTime: 30,
			};

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			Storage.get
				.mockReturnValueOnce(undefined) // CURRENT_WORKLOG_ID
				.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			ShiftWorklogs.formatForJanis.mockReturnValueOnce(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			// Con internet debe enviar los datos online
			expect(ShiftWorklogs.batch).toHaveBeenCalled();
			expect(result).toEqual(expect.any(String));
		});

		it('should throws an error when start date of new worklog is earlier than previous worklog start date', async () => {
			const mockShiftId = 'shift-123';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				startDate: '2024-01-01T08:00:00.000Z',
			};

			const mockCurrentWorkLog = {
				id: 'prev-worklog-id',
				referenceId: 'ref-123',
				name: 'Previous Work',
				type: 'work',
				startDate: '2024-01-01T10:00:00.000Z',
			};

			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true) // Para validar workLog entrante
				.mockReturnValueOnce(true); // Para validar data en getCurrentWorkLog
			Storage.get
				.mockReturnValueOnce('prev-worklog-id') // hasWorkLogInProgress
				.mockReturnValueOnce('prev-worklog-id') // getCurrentWorkLog id
				.mockReturnValueOnce(mockCurrentWorkLog) // getCurrentWorkLog data
				.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			ShiftWorklogs.createId = jest.fn(() => 'ref-123-mock-random-id');

			await expect(Shift.openWorkLog(mockParams)).rejects.toThrow(
				"The new activity's start date is earlier than previous activity start date."
			);
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should open excluded worklog types without pausing shift (startDate as milliseconds)', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'picking-mock-random-id';
			const msStartDate = 1736496000000;
			const expectedISO = new Date(msStartDate).toISOString();
			const mockParams = {
				referenceId: EXCLUDED_WORKLOG_TYPES[0], // 'default-picking-work'
				name: 'Picking Work',
				type: 'work',
				suggestedTime: 30,
				startDate: msStartDate,
			};

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			Storage.get
				.mockReturnValueOnce(undefined) // CURRENT_WORKLOG_ID
				.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(false);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: expectedISO,
			});
			// No debe pausar el turno para actividades excluidas
			expect(Storage.set).not.toHaveBeenCalledWith(SHIFT_STATUS, 'paused');
			expect(Storage.set).toHaveBeenCalledWith(CURRENT_WORKLOG_ID, mockFormattedId);
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.objectContaining({
					referenceId: mockParams.referenceId,
					type: mockParams.type,
					startDate: expectedISO,
					shiftId: mockShiftId,
				})
			);
			expect(result).toEqual(expect.any(String));
		});
		it('should include previous worklog when another is in progress (different referenceId)', async () => {
			const mockShiftId = 'shift-123';
			const mockParams = {
				referenceId: 'ref-456',
				name: 'New Work',
				type: 'work',
				suggestedTime: 30,
			};

			const mockCurrentWorkLog = {
				id: 'prev-worklog-id',
				referenceId: 'ref-123',
				name: 'Previous Work',
				type: 'work',
				startDate: '2024-01-01T10:00:00.000Z',
			};

			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true) // Para validar workLog entrante
				.mockReturnValueOnce(true); // Para validar data en getCurrentWorkLog
			Storage.get
				.mockReturnValueOnce('prev-worklog-id') // hasWorkLogInProgress
				.mockReturnValueOnce('prev-worklog-id') // getCurrentWorkLog id
				.mockReturnValueOnce(mockCurrentWorkLog) // getCurrentWorkLog data
				.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			ShiftWorklogs.createId = jest.fn(() => 'ref-456-mock-random-id');
			spyIsInternetReachable.mockResolvedValueOnce(false);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			expect(OfflineData.save).toHaveBeenNthCalledWith(1, 'prev-worklog-id', {
				referenceId: 'ref-123',
				endDate: mockDate.toISOString(),
			});
			expect(OfflineData.save).toHaveBeenNthCalledWith(2, expect.any(String), {
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'paused');
			expect(Storage.set).toHaveBeenCalledWith(CURRENT_WORKLOG_ID, expect.any(String));
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.objectContaining({type: mockParams.type})
			);
			expect(result).toEqual(expect.any(String));
		});

		it('should send worklogs online when there is internet and no pending data', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			ShiftWorklogs.formatForJanis.mockReturnValueOnce(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			const result = await Shift.openWorkLog(mockParams);

			expect(ShiftWorklogs.batch).toHaveBeenCalled();
			expect(result).toEqual(mockFormattedId);
		});

		it('should flush pending offline data online when internet is available', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			ShiftWorklogs.formatForJanis.mockReturnValue(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			const result = await Shift.openWorkLog(mockParams);

			expect(ShiftWorklogs.batch).toHaveBeenCalled();
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();
			expect(result).toEqual(mockFormattedId);
		});

		it('should reopen shift and retry when batch fails with closed shift error', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};
			const closedShiftError = {
				result: {message: 'No opened shift found for user 123'},
				statusCode: 404,
			};

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			mockOfflineData.hasData = false;
			ShiftWorklogs.formatForJanis = jest.fn(() => ['formatted']);
			ShiftWorklogs.batch
				.mockRejectedValueOnce(closedShiftError)
				.mockResolvedValueOnce(null);
			const reOpenSpy = jest.spyOn(Shift, 'reOpen').mockResolvedValueOnce(null);

			const result = await Shift.openWorkLog(mockParams);

			expect(reOpenSpy).toHaveBeenCalled();
			expect(ShiftWorklogs.batch).toHaveBeenCalledTimes(2);
			expect(result).toEqual(mockFormattedId);
			reOpenSpy.mockRestore();
		});

		it('should save offline when batch fails with API error (online flow, startDate as ISO string)', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const isoStartDate = '2026-01-10T08:00:00.000Z';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				startDate: isoStartDate,
			};

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			ShiftWorklogs.batch.mockRejectedValueOnce({result: {message: 'API Error'}, statusCode: 400});

			await expect(Shift.openWorkLog(mockParams)).rejects.toThrow('API Error');
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: isoStartDate,
			});
		});

		it('should throw when new activity start date is earlier than previous activity start date', async () => {
			const previousStartDate = '2024-01-01T12:00:00.000Z';
			const newStartDate = '2024-01-01T10:00:00.000Z';
			const mockParams = {
				referenceId: 'ref-456',
				name: 'New Work',
				type: 'work',
				suggestedTime: 30,
				startDate: newStartDate,
			};
			const mockCurrentWorkLog = {
				id: 'prev-worklog-id',
				referenceId: 'ref-123',
				name: 'Previous Work',
				type: 'work',
				startDate: previousStartDate,
			};

			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true) // workLog entrante
				.mockReturnValueOnce(true); // data en getCurrentWorkLog
			Storage.get
				.mockReturnValueOnce('prev-worklog-id') // hasWorkLogInProgress
				.mockReturnValueOnce('prev-worklog-id') // getCurrentWorkLog id
				.mockReturnValueOnce(mockCurrentWorkLog); // getCurrentWorkLog data

			await expect(Shift.openWorkLog(mockParams)).rejects.toThrow(
				"The new activity's start date is earlier than previous activity start date."
			);
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should use current date when startDate is omitted or invalid', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				suggestedTime: 30,
			};

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(false);

			const result = await Shift.openWorkLog(mockParams);

			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.objectContaining({
					referenceId: mockParams.referenceId,
					startDate: mockDate.toISOString(),
				})
			);
			expect(result).toEqual(mockFormattedId);
		});

		it('should save offline when batch fails with network error after internet check', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const isoStartDate = '2026-01-10T08:00:00.000Z';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				startDate: isoStartDate,
			};

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			ShiftWorklogs.batch.mockRejectedValueOnce(new Error('Network Error'));

			await expect(Shift.openWorkLog(mockParams)).rejects.toThrow('Network Error');
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: isoStartDate,
			});
		});

		it('should strip endDate from workLog when opening', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				startDate: '2024-01-15T09:00:00.000Z',
				endDate: '2024-01-15T10:00:00.000Z',
			};

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(false);

			await Shift.openWorkLog(mockParams);

			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.not.objectContaining({endDate: expect.anything()})
			);
		});
	});

	describe('finishWorkLog', () => {
		it('should throw error when no arguments are passed to finishWorkLog', async () => {
			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(false);

			await expect(Shift.finishWorkLog()).rejects.toThrow(
				'must provide a valid activity to close a work log'
			);
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});
		it('should throw error when user does not have staff authorization', async () => {
			spyHasAuthorization(false);
			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(true);
			await expect(Shift.finishWorkLog({referenceId: 'test'})).rejects.toThrow(
				'Staff MS authorization is required'
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should throw error when there is no active worklog to close', async () => {
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true) // Validar workLog entrante
				.mockReturnValueOnce(false) // En getCurrentWorkLog (data)
				.mockReturnValueOnce(false); // Validar currentWorkLog
			Storage.get.mockReturnValueOnce(null); // CURRENT_WORKLOG_ID

			await expect(Shift.finishWorkLog(mockParams)).rejects.toThrow(
				'There is no active worklog to close'
			);
			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should throw error when the worklog to close is different from the currently open one', async () => {
			const mockParams = {
				referenceId: 'ref-456', // Different from current worklog
				name: 'Test Work',
				type: 'work',
			};
			const mockCurrentWorkLog = {
				referenceId: 'ref-123', // Different referenceId
				name: 'Current Work',
				type: 'work',
			};

			Storage.get.mockReturnValueOnce(mockCurrentWorkLog);
			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true); // Para validar el worklog obtenido desde storage
			await expect(Shift.finishWorkLog(mockParams)).rejects.toThrow(
				'The worklog you are trying to close is different from the one that is currently open.'
			);
			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should throw error when end date of worklog is earlier than start date', async () => {
			const mockShiftStatus = 'opened';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				endDate: '2024-01-15T08:00:00.000Z',
			};
			const mockCurrentWorkLog = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				startDate: '2024-01-15T09:00:00.000Z',
			};

			Storage.get.mockReturnValueOnce(mockWorkLogId);
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog);
			Storage.get.mockReturnValueOnce(mockShiftStatus);
			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true) // Para validar workLog entrante
				.mockReturnValueOnce(true); // Para validar data en getCurrentWorkLog
			await expect(Shift.finishWorkLog(mockParams)).rejects.toThrow(
				"The activity's end date is earlier than its start date."
			);
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should finish worklog successfully', async () => {
			const mockShiftStatus = 'opened';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};
			const mockCurrentWorkLog = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				startDate: '2024-01-15T09:00:00.000Z',
			};

			Storage.get.mockReturnValueOnce(mockWorkLogId);
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog);
			Storage.get.mockReturnValueOnce(mockShiftStatus);
			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true) // Para validar workLog entrante
				.mockReturnValueOnce(true) // Para validar data en getCurrentWorkLog
				.mockReturnValueOnce(true); // Para validar el worklog obtenido desde storage
			spyIsInternetReachable.mockResolvedValueOnce(false);

			await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
			expect(Storage.remove).toHaveBeenCalled();
		});

		it('should save online when there is internet and no pending data', async () => {
			const mockShiftStatus = 'opened';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};
			const mockCurrentWorkLog = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				startDate: '2024-01-15T09:00:00.000Z',
			};

			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true) // Para validar workLog entrante
				.mockReturnValueOnce(true) // Para validar data en getCurrentWorkLog
				.mockReturnValueOnce(true); // Para validar el worklog obtenido desde storage
			mockOfflineData.hasData = false;

			Storage.get.mockReturnValueOnce(mockWorkLogId);
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog);
			Storage.get.mockReturnValueOnce(mockShiftStatus);

			spyIsInternetReachable.mockResolvedValueOnce(true);
			ShiftWorklogs.formatForJanis.mockReturnValueOnce(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			await Shift.finishWorkLog(mockParams);

			expect(ShiftWorklogs.batch).toHaveBeenCalled();
		});
		it('should flush pending offline data online when internet is available', async () => {
			const mockShiftStatus = 'opened';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};
			const mockCurrentWorkLog = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				startDate: '2024-01-15T09:00:00.000Z',
			};

			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true);
			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);

			Storage.get.mockReturnValueOnce(mockWorkLogId);
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog);
			Storage.get.mockReturnValueOnce(mockShiftStatus);

			spyIsInternetReachable.mockResolvedValueOnce(true);
			ShiftWorklogs.formatForJanis.mockReturnValue(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			await Shift.finishWorkLog(mockParams);

			expect(ShiftWorklogs.batch).toHaveBeenCalled();
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();
		});

		it('should resume shift when finishing worklog and shift is paused', async () => {
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};
			const mockCurrentWorkLog = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				startDate: '2024-01-15T09:00:00.000Z',
			};

			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true) // Para validar workLog entrante
				.mockReturnValueOnce(true) // Para validar data en getCurrentWorkLog
				.mockReturnValueOnce(true); // Para validar el worklog obtenido desde storage
			spyIsInternetReachable.mockResolvedValueOnce(true);
			Storage.get.mockReturnValueOnce(mockWorkLogId); // CURRENT_WORKLOG_ID
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog); // CURRENT_WORKLOG_DATA
			Storage.get.mockReturnValueOnce('paused'); // SHIFT_STATUS

			await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
			expect(ShiftWorklogs.batch).toHaveBeenCalled();
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'opened');
			expect(Storage.remove).toHaveBeenCalled();
		});

		it('should reOpen and retry when batch fails with closed shift error (online flow)', async () => {
			const mockShiftStatus = 'opened';
			const mockWorkLogId = 'worklog-999';
			const mockParams = {
				id: mockWorkLogId,
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};
			const mockCurrentWorkLog = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};
			const closedShiftError = {
				result: {message: 'No opened shift found for user 123'},
				statusCode: 404,
			};

			Storage.get.mockReturnValueOnce(mockWorkLogId);
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog);
			Storage.get.mockReturnValueOnce(mockShiftStatus);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true) // Para validar workLog entrante
				.mockReturnValueOnce(true) // Para validar data en getCurrentWorkLog
				.mockReturnValueOnce(true); // Para validar el worklog obtenido desde storage
			ShiftWorklogs.formatForJanis.mockReturnValue([
				{
					referenceId: 'ref-123',
					startDate: mockDate.toISOString(),
					endDate: mockDate.toISOString(),
				},
			]);
			ShiftWorklogs.batch
				.mockRejectedValueOnce(closedShiftError)
				.mockResolvedValueOnce(null);
			const reOpenSpy = jest.spyOn(Shift, 'reOpen').mockResolvedValueOnce(null);

			const result = await Shift.finishWorkLog(mockParams);

			expect(reOpenSpy).toHaveBeenCalled();
			expect(ShiftWorklogs.batch).toHaveBeenCalledTimes(2);
			expect(Storage.remove).toHaveBeenCalled();
			expect(result).toBe(mockWorkLogId);
			reOpenSpy.mockRestore();
		});

		it('should save offline when batch fails with network error after internet check', async () => {
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				id: mockWorkLogId,
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};
			const mockCurrentWorkLog = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				startDate: '2024-01-15T09:00:00.000Z',
			};

			jest
				.spyOn(ShiftWorklogs, 'isValidWorkLog')
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true);
			Storage.get.mockReturnValueOnce(mockWorkLogId);
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog);
			Storage.get.mockReturnValueOnce('opened');
			spyIsInternetReachable.mockResolvedValueOnce(true);
			ShiftWorklogs.batch.mockRejectedValueOnce(new Error('Network Error'));

			await expect(Shift.finishWorkLog(mockParams)).rejects.toThrow('Network Error');
			expect(OfflineData.save).toHaveBeenCalledWith(mockWorkLogId, {
				referenceId: mockParams.referenceId,
				endDate: mockDate.toISOString(),
			});
			expect(Storage.remove).toHaveBeenCalled();
		});
	});

	describe('checkStaffMSAuthorization', () => {
		it('should return true when enabledShiftAndWorkLog is true', async () => {
			StaffService.getSettings.mockResolvedValueOnce({
				enabledShiftAndWorkLog: true,
			});

			const result = await Shift.checkStaffMSAuthorization();

			expect(result).toBe(true);
		});

		it('should return false when enabledShiftAndWorkLog is false', async () => {
			StaffService.getSettings.mockResolvedValueOnce({
				enabledShiftAndWorkLog: false,
			});

			const result = await Shift.checkStaffMSAuthorization();

			expect(result).toBe(false);
		});

		it('should return false when enabledShiftAndWorkLog is undefined', async () => {
			StaffService.getSettings.mockResolvedValueOnce({
				otherSetting: true,
			});

			const result = await Shift.checkStaffMSAuthorization();

			expect(result).toBe(false);
		});

		it('should return false when result is undefined', async () => {
			StaffService.getSettings.mockResolvedValueOnce(undefined);

			const result = await Shift.checkStaffMSAuthorization();

			expect(result).toBe(false);
		});

		it('should return false when response has no result property', async () => {
			StaffService.getSettings.mockResolvedValueOnce({});

			const result = await Shift.checkStaffMSAuthorization();

			expect(result).toBe(false);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('Setting check failed');
			StaffService.getSettings.mockRejectedValueOnce(error);

			await expect(Shift.checkStaffMSAuthorization()).rejects.toThrow(error);
		});
	});

	describe('getGlobalStaffSettings', () => {
		it('should return cache settings', async () => {
			const cachedSettings = {
				enabledShiftAndWorkLog: true,
				inactivityTimeout: 30,
				otherSetting: true,
			};
			StaffService.getSettings.mockReturnValueOnce(cachedSettings);

			const result = await Shift.getGlobalStaffSettings();

			expect(result).toEqual({
				enabledShiftAndWorkLog: true,
				inactivityTimeout: 30,
			});
		});

		it('should return default global settings when settings cannot be fetched', async () => {
			StaffService.getSettings.mockReturnValueOnce(undefined);

			const result = await Shift.getGlobalStaffSettings();

			expect(result).toEqual({
				enabledShiftAndWorkLog: false,
				inactivityTimeout: 0,
			});
		});
		it('should throw an error when API request fails', async () => {
			const error = new Error('API Error');

			StaffService.getSettings.mockRejectedValueOnce(error);

			await expect(Shift.getGlobalStaffSettings()).rejects.toThrow('API Error');
		});
	});
	describe('getWorkLogs', () => {
		it('should throw error when user does not have staff authorization', async () => {
			spyHasAuthorization(false);

			await expect(Shift.getWorkLogs('shift-123')).rejects.toThrow(
				'Staff MS authorization is required'
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should get work logs successfully when shiftId is provided as argument', async () => {
			const mockShiftId = 'shift-123';
			ShiftWorklogs.getList.mockResolvedValueOnce(mockWorkLogsRaw);
			Formatter.formatWorkLogsFromJanis.mockReturnValueOnce(mockWorkLogs);

			const result = await Shift.getWorkLogs(mockShiftId);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('getWorkLogs:');
			expect(ShiftWorklogs.getList).toHaveBeenCalledWith(mockShiftId);
			expect(Formatter.formatWorkLogsFromJanis).toHaveBeenCalledWith(mockWorkLogsRaw);
			expect(result).toEqual(mockWorkLogs);
		});

		it('should get work logs successfully when shiftId is obtained from storage', async () => {
			const mockShiftId = 'shift-456';
			Storage.get.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.getList.mockResolvedValueOnce(mockWorkLogsRaw);
			Formatter.formatWorkLogsFromJanis.mockReturnValueOnce(mockWorkLogs);

			const result = await Shift.getWorkLogs();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('getWorkLogs:');
			expect(Storage.get).toHaveBeenCalledWith(SHIFT_ID);
			expect(ShiftWorklogs.getList).toHaveBeenCalledWith(mockShiftId);
			expect(Formatter.formatWorkLogsFromJanis).toHaveBeenCalledWith(mockWorkLogsRaw);
			expect(result).toEqual(mockWorkLogs);
		});

		it('should throw error when shiftId is not found', async () => {
			Storage.get.mockReturnValueOnce(undefined);

			await expect(Shift.getWorkLogs()).rejects.toThrow('Shift ID not found');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('getWorkLogs:');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
			expect(ShiftWorklogs.getList).not.toHaveBeenCalled();
		});
	});

	describe('hasWorkTypes', () => {
		it('should return true when storage has workLogTypes data', () => {
			const storageData = {workLogTypes: [{id: 'type-1'}]};
			Storage.get.mockReturnValueOnce(storageData);

			const result = Shift.hasWorkTypes;

			expect(Storage.get).toHaveBeenCalledWith(WORKLOG_TYPES_DATA);
			expect(result).toBe(true);
		});

		it('should return false when storage has no data (defaults applied)', () => {
			Storage.get.mockReturnValueOnce(undefined);

			const result = Shift.hasWorkTypes;

			expect(Storage.get).toHaveBeenCalledWith(WORKLOG_TYPES_DATA);
			expect(result).toBe(false);
		});
	});

	describe('isOpen', () => {
		it('should return true when shift status is opened', () => {
			Storage.get.mockReturnValueOnce('opened');

			const result = Shift.isOpen;

			expect(Storage.get).toHaveBeenCalledWith(SHIFT_STATUS);
			expect(result).toBe(true);
		});

		it('should return false when shift status is not opened', () => {
			Storage.get.mockReturnValueOnce('closed');

			const result = Shift.isOpen;

			expect(Storage.get).toHaveBeenCalledWith(SHIFT_STATUS);
			expect(result).toBe(false);
		});
	});

	describe('isExpired', () => {
		it('should return false when dateMaxToClose is not exceeded', () => {
			const storageData = {
				dateMaxToClose: '2024-01-15T20:00:00.000Z', // Fecha futura (9.5 horas después del mockDate)
			};

			Storage.get.mockReturnValueOnce(storageData);

			const result = Shift.isExpired();

			expect(result).toBe(false);
		});

		it('should return true when dateMaxToClose is exceeded', () => {
			const storageData = {
				dateMaxToClose: '2024-01-15T09:00:00.000Z', // Fecha pasada (1.5 horas antes del mockDate)
			};

			Storage.get.mockReturnValueOnce(storageData);

			const result = Shift.isExpired();

			expect(result).toBe(true);
		});
	});

	describe('isClosed', () => {
		it('should return false when shift is open', async () => {
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [{status: 'opened'}],
			});

			const result = await Shift.isClosed();

			expect(result).toBe(false);
		});

		it('should return true when no open shift is found', async () => {
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [],
			});

			const result = await Shift.isClosed();

			expect(result).toBe(true);
		});

		it('should return true when shift list result is undefined', async () => {
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: undefined,
			});

			const result = await Shift.isClosed();

			expect(result).toBe(true);
		});
	});

	describe('sendPendingWorkLogs', () => {
		it('should throw error when user does not have staff authorization', async () => {
			spyHasAuthorization(false);

			await expect(Shift.sendPendingWorkLogs()).rejects.toThrow(
				'Staff MS authorization is required'
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should send pending worklogs successfully', async () => {
			// Hay datos pendientes
			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			ShiftWorklogs.formatForJanis = jest.fn(() => mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			const result = await Shift.sendPendingWorkLogs();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('sendPendingWorkLogs:');
			expect(mockOfflineData.get).toHaveBeenCalled();
			expect(ShiftWorklogs.formatForJanis).toHaveBeenCalledWith(mockPendingWorkLogs);
			expect(ShiftWorklogs.batch).toHaveBeenCalledWith(mockFormattedOfflineWorkLogs);
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();
			expect(result).toBe(null);
		});

		it('should reopen a shift if batch fails with closed shift error', async () => {
			const closedShiftError = {
				result: {message: 'No opened shift found for user 123'},
				statusCode: 404,
			};
			const reOpenSpy = jest.spyOn(Shift, 'reOpen').mockResolvedValueOnce(null);

			// Hay datos pendientes
			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			ShiftWorklogs.formatForJanis = jest.fn(() => mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch
				.mockRejectedValueOnce(closedShiftError)
				.mockResolvedValueOnce(null);

			const result = await Shift.sendPendingWorkLogs();

			expect(reOpenSpy).toHaveBeenCalled();
			expect(ShiftWorklogs.batch).toHaveBeenCalledTimes(2);
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();
			expect(result).toBe(null);
			reOpenSpy.mockRestore();
		});

		it('should return null when no data to send', async () => {
			// Hay datos pendientes pero al formatear queda vacío
			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce([]);
			ShiftWorklogs.formatForJanis = jest.fn(() => []);
			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValue(false);

			const result = await Shift.sendPendingWorkLogs();

			expect(mockOfflineData.get).toHaveBeenCalled();
			expect(ShiftWorklogs.formatForJanis).toHaveBeenCalledWith([]);
			expect(ShiftWorklogs.batch).not.toHaveBeenCalled();
			expect(mockOfflineData.deleteAll).not.toHaveBeenCalled();
			expect(result).toBe(null);
		});

		it('should return null when there is no pending data', async () => {
			// No hay datos pendientes: retorna temprano sin consultar OfflineData
			mockOfflineData.hasData = false;

			const result = await Shift.sendPendingWorkLogs();

			jest.spyOn(ShiftWorklogs, 'isValidWorkLog').mockReturnValueOnce(false);
			expect(mockOfflineData.get).not.toHaveBeenCalled();
			expect(ShiftWorklogs.batch).not.toHaveBeenCalled();
			expect(mockOfflineData.deleteAll).not.toHaveBeenCalled();
			expect(result).toBe(null);
		});
	});

	describe('resetInactivityTimer', () => {
		it('should not call ShiftInactivity.resetTimer when user does not have staff authorization', () => {
			spyHasAuthorization(false);
			const spy = jest.spyOn(ShiftInactivity, 'resetTimer');

			Shift.resetInactivityTimer();

			expect(spy).not.toHaveBeenCalled();
		});

		it('should call ShiftInactivity.resetTimer when user has staff authorization', () => {
			const spy = jest.spyOn(ShiftInactivity, 'resetTimer');

			Shift.resetInactivityTimer();

			expect(spy).toHaveBeenCalled();
		});
	});

	describe('stopInactivityTimer', () => {
		it('should not call ShiftInactivity.stopTimer when user does not have staff authorization', () => {
			spyHasAuthorization(false);
			const spy = jest.spyOn(ShiftInactivity, 'stopTimer');

			Shift.stopInactivityTimer();

			expect(spy).not.toHaveBeenCalled();
		});

		it('should call ShiftInactivity.stopTimer when user has staff authorization', () => {
			const spy = jest.spyOn(ShiftInactivity, 'stopTimer');

			Shift.stopInactivityTimer();

			expect(spy).toHaveBeenCalled();
		});
	});

	describe('reOpen', () => {
		it('should throw error when user does not have staff authorization', async () => {
			spyHasAuthorization(false);

			await expect(Shift.reOpen()).rejects.toThrow('Staff MS authorization is required');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		const storageData = {
			dateToClose: '2024-01-15T17:00:00.000Z',
			dateMaxToClose: '2024-01-15T20:00:00.000Z', // Fecha futura (9.5 horas después del mockDate)
		};
		it('should reopen shift successfully and extend closing date', async () => {
			jest.spyOn(Shift, 'isExpired').mockReturnValueOnce(false);
			Storage.get.mockReturnValue({...storageData, reopeningExtensionTime: 1});
			StaffService.openShift.mockResolvedValueOnce({});

			const result = await Shift.reOpen();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('reOpenShift:');
			expect(Shift.isExpired).toHaveBeenCalled();
			expect(StaffService.openShift).toHaveBeenCalled();
			expect(result).toBe(null);
		});

		it('should reject when max close deadline is exceeded', async () => {
			// Mock isExpired to return true (expired)
			jest.spyOn(Shift, 'isExpired').mockReturnValueOnce(true);
			Storage.get.mockReturnValueOnce(storageData);

			await expect(Shift.reOpen()).rejects.toThrow(
				'The deadline for ending the shift has been exceeded'
			);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('reOpenShift:');
			expect(Shift.isExpired).toHaveBeenCalled();
			expect(StaffService.openShift).not.toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should handle reOpen error', async () => {
			const error = new Error('Reopen shift failed');
			jest.spyOn(Shift, 'isExpired').mockReturnValueOnce(false);
			Storage.get.mockReturnValueOnce(storageData);
			StaffService.openShift.mockRejectedValueOnce(error);

			await expect(Shift.reOpen()).rejects.toThrow('Reopen shift failed');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});
	});
});
