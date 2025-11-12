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
} from '../lib/constant';
import Storage from '../lib/db/StorageService';
import ShiftWorklogs from '../lib/ShiftWorklogs';
import {getStaffAuthorizationData} from '../lib/utils/storage';
import Formatter from '../lib/Formatter';
import Shift from '../lib/Shift';
import OfflineData from '../lib/OfflineData';

// Mock para Date
const mockDate = new Date('2024-01-15T10:30:00.000Z');
const RealDate = Date;

const spyIsInternetReachable = jest.spyOn(deviceInfo, 'getInternetReachability');

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

	describe('open', () => {
		it('should throw error when user does not have staff authorization', async () => {
			// Mock getStaffAuthorizationData to return false for this test
			getStaffAuthorizationData.mockReturnValueOnce({hasStaffAuthorization: false});

			await expect(Shift.open()).rejects.toThrow('Staff MS authorization is required');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should start a shift successfully', async () => {
			const mockShiftId = 'shift-123';
			const mockOpenShift = {id: mockShiftId, startDate: '2024-01-15T10:00:00.000Z'};

			StaffService.openShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [mockOpenShift],
			});

			const result = await Shift.open();

			expect(Storage.set).toHaveBeenCalledTimes(3);
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_ID, mockShiftId);
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'opened');
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_DATA, mockOpenShift);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.openShift).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
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

	describe('finish', () => {
		it('should throw error when user does not have staff authorization', async () => {
			getStaffAuthorizationData.mockReturnValueOnce({hasStaffAuthorization: false});

			await expect(Shift.finish()).rejects.toThrow('Staff MS authorization is required');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should finish a shift successfully and send pending worklogs', async () => {
			const mockShiftId = 'shift-999';

			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);

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

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
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

			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);
			mockOfflineData.hasData = false;

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			Storage.get.mockReturnValueOnce(mockShiftData);

			const result = await Shift.finish();

			expect(mockOfflineData.get).not.toHaveBeenCalled();
			expect(Formatter.formatOfflineWorkLog).not.toHaveBeenCalled();
			expect(ShiftWorklogs.batch).not.toHaveBeenCalled();

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				expect.objectContaining({endDate: mockDate.toISOString()})
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should reopen a shift if it is expired before to finish', async () => {
			const mockShiftId = 'shift-999';

			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(true);
			jest.spyOn(Shift, 'isExpired').mockReturnValueOnce(false);

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

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				expect.objectContaining({endDate: mockDate.toISOString()})
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should finish a shift with specific date', async () => {
			const mockShiftId = 'shift-888';
			const specificDate = '2024-01-15T18:00:00.000Z';

			mockOfflineData.hasData = false;
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			Storage.get.mockReturnValueOnce(mockShiftData);

			const result = await Shift.finish({date: specificDate});

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
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
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);

			StaffService.closeShift.mockResolvedValueOnce({
				result: undefined,
			});
			Storage.get.mockReturnValueOnce(mockShiftData);

			const result = await Shift.finish({date: specificDate});

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
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
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);
			Storage.get.mockReturnValueOnce(mockShiftData);

			StaffService.closeShift.mockRejectedValueOnce(error);

			await expect(Shift.finish()).rejects.toThrow('Close shift failed');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should finish a shift successfully with minimal data', async () => {
			const mockShiftId = 'shift-777';

			mockOfflineData.hasData = false;
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			Storage.get.mockReturnValueOnce(mockShiftData);

			const result = await Shift.finish();

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
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
			getStaffAuthorizationData.mockReturnValueOnce({hasStaffAuthorization: false});

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
			getStaffAuthorizationData.mockReturnValueOnce({hasStaffAuthorization: false});

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
			const result = await Shift.openWorkLog();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', {});
			expect(result).toBeNull();
		});

		it('should throw error when user does not have staff authorization', async () => {
			getStaffAuthorizationData.mockReturnValueOnce({hasStaffAuthorization: false});

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

			Storage.get
				.mockReturnValueOnce(undefined) // CURRENT_WORKLOG_ID
				.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);
			ShiftWorklogs.formatForJanis.mockReturnValueOnce(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			// Con internet debe enviar los datos online
			expect(ShiftWorklogs.batch).toHaveBeenCalled();
			expect(result).toEqual(expect.any(String));
		});

		it('should open excluded worklog types without pausing shift', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'picking-mock-random-id';
			const mockParams = {
				referenceId: EXCLUDED_WORKLOG_TYPES[0], // 'default-picking-work'
				name: 'Picking Work',
				type: 'work',
				suggestedTime: 30,
			};

			Storage.get
				.mockReturnValueOnce(undefined) // CURRENT_WORKLOG_ID
				.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(false);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			// No debe pausar el turno para actividades excluidas
			expect(Storage.set).not.toHaveBeenCalledWith(SHIFT_STATUS, 'paused');
			expect(Storage.set).toHaveBeenCalledWith(CURRENT_WORKLOG_ID, mockFormattedId);
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.objectContaining({
					referenceId: mockParams.referenceId,
					type: mockParams.type,
					startDate: mockDate.toISOString(),
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

			Storage.get
				.mockReturnValueOnce('prev-worklog-id') // hasWorkLogInProgress
				.mockReturnValueOnce('prev-worklog-id') // getCurrentWorkLog id
				.mockReturnValueOnce(mockCurrentWorkLog) // getCurrentWorkLog data
				.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			spyIsInternetReachable.mockResolvedValueOnce(false);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			expect(ShiftWorklogs.createId).toHaveBeenCalledWith(mockParams.referenceId);
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

			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);
			ShiftWorklogs.formatForJanis.mockReturnValueOnce(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			const result = await Shift.openWorkLog(mockParams);

			expect(ShiftWorklogs.batch).toHaveBeenCalled();
			expect(result).toEqual(mockFormattedId);
		});

		it('should reopen shift and send pending data when expired and has pending offline', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(true);
			const reOpenSpy = jest.spyOn(Shift, 'reOpen').mockResolvedValueOnce(null);
			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			ShiftWorklogs.formatForJanis = jest.fn(() => ['formatted']);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			const result = await Shift.openWorkLog(mockParams);

			expect(reOpenSpy).toHaveBeenCalled();
			expect(mockOfflineData.get).toHaveBeenCalled();
			expect(ShiftWorklogs.batch).toHaveBeenCalled();
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();
			expect(result).toEqual(mockFormattedId);
			reOpenSpy.mockRestore();
		});

		it('should save offline when batch fails with API error (online flow)', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.get.mockReturnValueOnce(undefined).mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.createId = jest.fn(() => mockFormattedId);
			spyIsInternetReachable.mockResolvedValueOnce(true);
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);
			ShiftWorklogs.batch.mockRejectedValueOnce({result: {message: 'API Error'}, statusCode: 400});

			await expect(Shift.openWorkLog(mockParams)).rejects.toThrow('API Error');
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
		});
	});

	describe('finishWorkLog', () => {
		it('should return null when no arguments are passed to finishWorkLog', async () => {
			const result = await Shift.finishWorkLog();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', {});
			expect(result).toBeNull();
			expect(ShiftWorklogs.finish).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
			expect(Storage.remove).not.toHaveBeenCalled();
		});
		it('should throw error when user does not have staff authorization', async () => {
			getStaffAuthorizationData.mockReturnValueOnce({hasStaffAuthorization: false});

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

			Storage.get.mockReturnValueOnce(null);

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

			await expect(Shift.finishWorkLog(mockParams)).rejects.toThrow(
				'The worklog you are trying to close is different from the one that is currently open.'
			);
			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
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
			};

			Storage.get.mockReturnValueOnce(mockWorkLogId);
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog);
			Storage.get.mockReturnValueOnce(mockShiftStatus);

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
			};

			mockOfflineData.hasData = false;

			Storage.get.mockReturnValueOnce(mockWorkLogId);
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog);
			Storage.get.mockReturnValueOnce(mockShiftStatus);

			spyIsInternetReachable.mockResolvedValueOnce(true);
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);
			ShiftWorklogs.formatForJanis.mockReturnValueOnce(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			await Shift.finishWorkLog(mockParams);

			expect(ShiftWorklogs.batch).toHaveBeenCalled();
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
			};
			spyIsInternetReachable.mockResolvedValueOnce(true);
			Storage.get.mockReturnValueOnce(mockWorkLogId); // CURRENT_WORKLOG_ID
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog); // CURRENT_WORKLOG_DATA
			Storage.get.mockReturnValueOnce('paused'); // SHIFT_STATUS
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);

			await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
			expect(ShiftWorklogs.batch).toHaveBeenCalled();
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'opened');
			expect(Storage.remove).toHaveBeenCalled();
		});

		it('should reOpen and save offline when batch fails with API error (online flow)', async () => {
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

			Storage.get.mockReturnValueOnce(mockWorkLogId);
			Storage.get.mockReturnValueOnce(mockCurrentWorkLog);
			Storage.get.mockReturnValueOnce(mockShiftStatus);

			spyIsInternetReachable.mockResolvedValueOnce(true);
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(true);
			jest.spyOn(Shift, 'reOpen').mockResolvedValueOnce(null);

			ShiftWorklogs.formatForJanis.mockReturnValueOnce([
				{
					referenceId: 'ref-123',
					startDate: mockDate.toISOString(),
					endDate: mockDate.toISOString(),
				},
			]);
			ShiftWorklogs.batch.mockRejectedValueOnce({result: {message: 'API Error'}, statusCode: 400});

			await expect(Shift.finishWorkLog(mockParams)).rejects.toThrow('API Error');
			expect(OfflineData.save).toHaveBeenCalledWith(mockWorkLogId, {
				referenceId: mockParams.referenceId,
				endDate: mockDate.toISOString(),
			});
			expect(Storage.remove).toHaveBeenCalled();
		});
	});

	describe('checkStaffMSAuthorization', () => {
		it('should return true when enabledShiftAndWorkLog is true', async () => {
			StaffService.getSetting.mockResolvedValueOnce({
				result: {
					enabledShiftAndWorkLog: true,
				},
			});

			const result = await Shift.checkStaffMSAuthorization();

			expect(StaffService.getSetting).toHaveBeenCalledWith('global');
			expect(result).toBe(true);
		});

		it('should return false when enabledShiftAndWorkLog is false', async () => {
			StaffService.getSetting.mockResolvedValueOnce({
				result: {
					enabledShiftAndWorkLog: false,
				},
			});

			const result = await Shift.checkStaffMSAuthorization();

			expect(StaffService.getSetting).toHaveBeenCalledWith('global');
			expect(result).toBe(false);
		});

		it('should return false when enabledShiftAndWorkLog is undefined', async () => {
			StaffService.getSetting.mockResolvedValueOnce({
				result: {
					otherSetting: true,
				},
			});

			const result = await Shift.checkStaffMSAuthorization();

			expect(StaffService.getSetting).toHaveBeenCalledWith('global');
			expect(result).toBe(false);
		});

		it('should return false when result is undefined', async () => {
			StaffService.getSetting.mockResolvedValueOnce({
				result: undefined,
			});

			const result = await Shift.checkStaffMSAuthorization();

			expect(StaffService.getSetting).toHaveBeenCalledWith('global');
			expect(result).toBe(false);
		});

		it('should return false when response has no result property', async () => {
			StaffService.getSetting.mockResolvedValueOnce({});

			const result = await Shift.checkStaffMSAuthorization();

			expect(StaffService.getSetting).toHaveBeenCalledWith('global');
			expect(result).toBe(false);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('Setting check failed');
			StaffService.getSetting.mockRejectedValueOnce(error);

			await expect(Shift.checkStaffMSAuthorization()).rejects.toThrow('Setting check failed');
			expect(mockCrashlytics.recordError).toHaveBeenCalledWith(
				error,
				'Error checking staff MS authorization'
			);
		});
	});

	describe('getWorkLogs', () => {
		it('should throw error when user does not have staff authorization', async () => {
			getStaffAuthorizationData.mockReturnValueOnce({hasStaffAuthorization: false});

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

	describe('isClosed', () => {
		it('should return false when dateToClose is not exceeded', () => {
			const storageData = {
				dateToClose: '2024-01-15T18:00:00.000Z', // Fecha futura (7.5 horas después del mockDate)
			};

			Storage.get.mockReturnValueOnce(storageData);

			const result = Shift.isClosed();

			expect(result).toBe(false);
		});

		it('should return true when dateToClose is exceeded', () => {
			const storageData = {
				dateToClose: '2024-01-15T08:00:00.000Z', // Fecha pasada (2.5 horas antes del mockDate)
			};

			Storage.get.mockReturnValueOnce(storageData);

			const result = Shift.isClosed();

			expect(result).toBe(true);
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

	describe('sendPendingWorkLogs', () => {
		it('should throw error when user does not have staff authorization', async () => {
			getStaffAuthorizationData.mockReturnValueOnce({hasStaffAuthorization: false});

			await expect(Shift.sendPendingWorkLogs()).rejects.toThrow(
				'Staff MS authorization is required'
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should send pending worklogs successfully', async () => {
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(false);

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

		it('should reopen a shift if it is expired before to send pending worklogs', async () => {
			jest.spyOn(Shift, 'isClosed').mockReturnValueOnce(true);
			jest.spyOn(Shift, 'isExpired').mockReturnValueOnce(false);
			const reOpenSpy = jest.spyOn(Shift, 'reOpen').mockResolvedValueOnce(null);

			// Hay datos pendientes
			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			ShiftWorklogs.formatForJanis = jest.fn(() => mockFormattedOfflineWorkLogs);
			ShiftWorklogs.batch.mockResolvedValueOnce(null);

			const result = await Shift.sendPendingWorkLogs();

			expect(mockOfflineData.get).toHaveBeenCalled();
			expect(ShiftWorklogs.formatForJanis).toHaveBeenCalledWith(mockPendingWorkLogs);
			expect(ShiftWorklogs.batch).toHaveBeenCalledWith(mockFormattedOfflineWorkLogs);
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();
			expect(reOpenSpy).toHaveBeenCalled();
			expect(result).toBe(null);
			reOpenSpy.mockRestore();
		});

		it('should return null when no data to send', async () => {
			// Hay datos pendientes pero al formatear queda vacío
			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce([]);
			ShiftWorklogs.formatForJanis = jest.fn(() => []);

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

			expect(mockOfflineData.get).not.toHaveBeenCalled();
			expect(ShiftWorklogs.batch).not.toHaveBeenCalled();
			expect(mockOfflineData.deleteAll).not.toHaveBeenCalled();
			expect(result).toBe(null);
		});
	});

	describe('reOpen', () => {
		it('should throw error when user does not have staff authorization', async () => {
			getStaffAuthorizationData.mockReturnValueOnce({hasStaffAuthorization: false});

			await expect(Shift.reOpen()).rejects.toThrow('Staff MS authorization is required');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		const storageData = {
			dateMaxToClose: '2024-01-15T20:00:00.000Z', // Fecha futura (9.5 horas después del mockDate)
		};
		it('should reopen shift successfully and extend closing date', async () => {
			jest.spyOn(Shift, 'isExpired').mockReturnValueOnce(false);
			Storage.get.mockReturnValueOnce({...storageData, reopeningExtensionTime: 1});
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
