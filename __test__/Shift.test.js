import {worklogTypes, parsedWorklogTypes} from '../__mocks__/worklogTypes';
import {
	mockCrashlytics,
	mockShiftData,
	mockWorkLogsEvents,
	mockFormattedActivities,
	mockWorkLogs,
	mockWorkLogsRaw,
	mockOfflineData,
	mockPendingWorkLogs,
	mockFormattedOfflineWorkLogs,
} from '../__mocks__';
import StaffService from '../lib/StaffApiServices';
import TimeTracker from '../lib/db/TimeTrackerService';
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
import TrackerRecords from '../lib/TrackerRecords';
import {getShiftData, getObject, getStaffAuthorizationData} from '../lib/utils/storage';
import Formatter from '../lib/Formatter';
import Shift from '../lib/Shift';
import OfflineData from '../lib/OfflineData';

// Mock para Date
const mockDate = new Date('2024-01-15T10:30:00.000Z');
const RealDate = Date;

describe('Shift', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks(); // Restaura todos los spies para evitar interferencias

		// Restaurar comportamiento por defecto de OfflineData
		mockOfflineData.save.mockImplementation(() => {});
		mockOfflineData.get.mockReturnValue([]);
		mockOfflineData.delete.mockImplementation(() => {});
		mockOfflineData.deleteAll.mockImplementation(() => {});

		// Resetear getObject mock completamente para evitar interferencias
		getObject.mockReset();

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
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.open();

			expect(Storage.set).toHaveBeenCalledTimes(3);
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_ID, mockShiftId);
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'opened');
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_DATA, JSON.stringify(mockOpenShift));
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.openShift).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
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
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.open({date: specificDate});

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_ID, mockShiftId);
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'opened');
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_DATA, JSON.stringify(mockOpenShift));
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('API Error');
			StaffService.openShift.mockRejectedValueOnce(error);

			await expect(Shift.open()).rejects.toThrow('API Error');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should continue even if TimeTracker fails', async () => {
			const mockShiftId = 'shift-789';
			const mockOpenShift = {id: mockShiftId, startDate: '2024-01-15T10:00:00.000Z'};

			StaffService.openShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [mockOpenShift],
			});
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('Tracking failed'));

			const result = await Shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should handle response without result', async () => {
			StaffService.openShift.mockResolvedValueOnce({});
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [],
			});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe('');
		});

		it('should handle response with result but without id', async () => {
			StaffService.openShift.mockResolvedValueOnce({result: {}});
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [],
			});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
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
			const expectedUpdatedShiftData = {
				...mockShiftData,
				id: mockShiftId,
				endDate: mockDate.toISOString(),
			};

			jest.spyOn(Shift, 'isDateToCloseExceeded').mockReturnValueOnce(false);

			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			mockOfflineData.deleteAll.mockImplementation(() => {});

			Formatter.formatOfflineWorkLog.mockReturnValueOnce(mockFormattedOfflineWorkLogs);

			ShiftWorklogs.postPendingBatch.mockResolvedValueOnce(null);

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			getObject.mockReturnValueOnce(mockShiftData);
			getShiftData.mockReturnValueOnce({...mockShiftData, id: mockShiftId});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finish();

			expect(mockOfflineData.get).toHaveBeenCalled();
			expect(Formatter.formatOfflineWorkLog).toHaveBeenCalledWith(mockPendingWorkLogs);
			expect(ShiftWorklogs.postPendingBatch).toHaveBeenCalledWith(mockFormattedOfflineWorkLogs);
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				JSON.stringify(expectedUpdatedShiftData)
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should finish a shift successfully without pending worklogs', async () => {
			const mockShiftId = 'shift-998';
			const expectedUpdatedShiftData = {
				...mockShiftData,
				id: mockShiftId,
				endDate: mockDate.toISOString(),
			};

			jest.spyOn(Shift, 'isDateToCloseExceeded').mockReturnValueOnce(false);
			mockOfflineData.hasData = false;

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			getObject.mockReturnValueOnce(mockShiftData);
			getShiftData.mockReturnValueOnce({...mockShiftData, id: mockShiftId});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finish();

			expect(mockOfflineData.get).not.toHaveBeenCalled();
			expect(Formatter.formatOfflineWorkLog).not.toHaveBeenCalled();
			expect(ShiftWorklogs.postPendingBatch).not.toHaveBeenCalled();

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				JSON.stringify(expectedUpdatedShiftData)
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should reopen a shift if it is expired before to finish', async () => {
			const mockShiftId = 'shift-999';
			const expectedUpdatedShiftData = {
				...mockShiftData,
				id: mockShiftId,
				endDate: mockDate.toISOString(),
			};

			jest.spyOn(Shift, 'isDateToCloseExceeded').mockReturnValueOnce(true);
			jest.spyOn(Shift, 'isDateMaxToCloseExceeded').mockReturnValueOnce(false);

			mockOfflineData.hasData = true;
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			mockOfflineData.deleteAll.mockImplementation(() => {});

			Formatter.formatOfflineWorkLog.mockReturnValueOnce(mockFormattedOfflineWorkLogs);

			ShiftWorklogs.postPendingBatch.mockResolvedValueOnce(null);

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			getObject.mockReturnValueOnce(mockShiftData);
			getObject.mockReturnValueOnce(mockShiftData);
			getShiftData.mockReturnValueOnce({...mockShiftData, id: mockShiftId});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finish();

			expect(mockOfflineData.get).toHaveBeenCalled();
			expect(Formatter.formatOfflineWorkLog).toHaveBeenCalledWith(mockPendingWorkLogs);
			expect(ShiftWorklogs.postPendingBatch).toHaveBeenCalledWith(mockFormattedOfflineWorkLogs);
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				JSON.stringify(expectedUpdatedShiftData)
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should finish a shift with specific date', async () => {
			const mockShiftId = 'shift-888';
			const specificDate = '2024-01-15T18:00:00.000Z';
			const expectedUpdatedShiftData = {
				...mockShiftData,
				id: mockShiftId,
				endDate: specificDate,
			};

			jest.spyOn(Shift, 'isDateToCloseExceeded').mockReturnValueOnce(false);

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			getObject.mockReturnValueOnce(mockShiftData);
			getShiftData.mockReturnValueOnce({...mockShiftData, id: mockShiftId});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finish({date: specificDate});

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				JSON.stringify(expectedUpdatedShiftData)
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should handle response with result but without id', async () => {
			const specificDate = '2024-01-15T18:00:00.000Z';
			const expectedUpdatedShiftData = {
				...mockShiftData,
				endDate: specificDate,
			};

			jest.spyOn(Shift, 'isDateToCloseExceeded').mockReturnValueOnce(false);

			StaffService.closeShift.mockResolvedValueOnce({
				result: undefined,
			});
			getObject.mockReturnValueOnce(mockShiftData);
			getShiftData.mockReturnValueOnce(mockShiftData);
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finish({date: specificDate});

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				JSON.stringify(expectedUpdatedShiftData)
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe('');
		});

		it('should handle staff service errors', async () => {
			const error = new Error('Close shift failed');
			jest.spyOn(Shift, 'isDateToCloseExceeded').mockReturnValueOnce(false);
			getObject.mockReturnValueOnce(mockShiftData);

			StaffService.closeShift.mockRejectedValueOnce(error);

			await expect(Shift.finish()).rejects.toThrow('Close shift failed');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should continue even if TimeTracker fails in finish', async () => {
			const mockShiftId = 'shift-777';
			const expectedUpdatedShiftData = {
				...mockShiftData,
				id: mockShiftId,
				endDate: mockDate.toISOString(),
			};

			jest.spyOn(Shift, 'isDateToCloseExceeded').mockReturnValueOnce(false);

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			getObject.mockReturnValueOnce(mockShiftData);
			getShiftData.mockReturnValueOnce({...mockShiftData, id: mockShiftId});
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('Tracking failed'));

			const result = await Shift.finish();

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.set).toHaveBeenCalledWith(
				SHIFT_DATA,
				JSON.stringify(expectedUpdatedShiftData)
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
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
			TimeTracker.deleteAllEvents.mockResolvedValueOnce(true);

			const result = await Shift.deleteShiftRegisters();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('deleteShiftRegisters:');
			expect(TimeTracker.deleteAllEvents).toHaveBeenCalled();
			expect(result).toBe(true);
		});

		it('should handle TimeTracker errors', async () => {
			const error = new Error('Delete failed');
			TimeTracker.deleteAllEvents.mockRejectedValueOnce(error);

			await expect(Shift.deleteShiftRegisters()).rejects.toThrow('Delete failed');
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});
	});

	describe('openWorkLog', () => {
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

			Storage.getString.mockReturnValueOnce(mockShiftId);
			TimeTracker.addEvent.mockResolvedValueOnce();
			Formatter.formatWorkLogId.mockReturnValueOnce(mockFormattedId);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			// expect(ShiftWorklogs.open).toHaveBeenCalledWith({
			// 	referenceId: mockParams.referenceId,
			// 	startDate: mockDate.toISOString(),
			// });
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
				id: mockFormattedId,
				time: mockDate.toISOString(),
				type: 'start',
				payload: {
					type: mockParams.type,
					name: mockParams.name,
					shiftId: mockShiftId,
					referenceId: mockParams.referenceId,
				},
			});
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'paused');
			expect(Storage.set).toHaveBeenCalledWith(CURRENT_WORKLOG_ID, mockFormattedId);
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.stringContaining(mockParams.type)
			);
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.stringContaining(mockDate.toISOString())
			);
			expect(result).toEqual(mockFormattedId);
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

			Storage.getString.mockReturnValueOnce(mockShiftId);
			TimeTracker.addEvent.mockResolvedValueOnce();
			Formatter.formatWorkLogId.mockReturnValueOnce(mockFormattedId);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			// expect(ShiftWorklogs.open).toHaveBeenCalledWith({
			// 	referenceId: mockParams.referenceId,
			// 	startDate: mockDate.toISOString(),
			// });
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
				id: mockFormattedId,
				time: mockDate.toISOString(),
				type: 'start',
				payload: {
					type: mockParams.type,
					name: mockParams.name,
					shiftId: mockShiftId,
					referenceId: mockParams.referenceId,
				},
			});
			// No debe pausar el turno para actividades excluidas
			expect(Storage.set).not.toHaveBeenCalledWith(SHIFT_STATUS, 'paused');
			expect(Storage.set).toHaveBeenCalledWith(CURRENT_WORKLOG_ID, mockFormattedId);
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.stringContaining(mockParams.type)
			);
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.stringContaining(mockDate.toISOString())
			);
			expect(result).toEqual(mockFormattedId);
		});

		it('should open worklog with default params', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			TimeTracker.addEvent.mockResolvedValueOnce();
			Formatter.formatWorkLogId.mockReturnValueOnce(mockFormattedId);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			// expect(ShiftWorklogs.open).toHaveBeenCalledWith({
			// 	referenceId: mockParams.referenceId,
			// 	startDate: mockDate.toISOString(),
			// });
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'paused');
			expect(Storage.set).toHaveBeenCalledWith(CURRENT_WORKLOG_ID, mockFormattedId);
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.stringContaining(mockParams.type)
			);
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.stringContaining(mockDate.toISOString())
			);
			expect(result).toEqual(mockFormattedId);
		});

		it('should handle OfflineData save errors', async () => {
			const error = new Error('OfflineData save failed');
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			Formatter.formatWorkLogId.mockReturnValueOnce(mockFormattedId);
			OfflineData.save.mockImplementation(() => {
				throw error;
			});

			await expect(Shift.openWorkLog(mockParams)).rejects.toThrow('OfflineData save failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			// expect(ShiftWorklogs.open).toHaveBeenCalled();
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should continue even if TimeTracker fails', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			Formatter.formatWorkLogId.mockReturnValueOnce(mockFormattedId);

			TimeTracker.addEvent.mockRejectedValueOnce(new Error('TimeTracker failed'));

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', mockParams);
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			// expect(ShiftWorklogs.open).toHaveBeenCalled();
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'paused');
			expect(result).toEqual(mockFormattedId);
		});

		it('should calculate suggested finish date correctly', async () => {
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				suggestedTime: 15, // 15 minutos
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			Formatter.formatWorkLogId.mockReturnValueOnce(mockFormattedId);

			TimeTracker.addEvent.mockResolvedValueOnce();

			await Shift.openWorkLog(mockParams);

			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			// expect(ShiftWorklogs.open).toHaveBeenCalled();
			expect(OfflineData.save).toHaveBeenCalledWith(mockFormattedId, {
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'paused');
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.stringContaining(mockParams.type)
			);
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.stringContaining(mockDate.toISOString())
			);
		});

		it('should return null when no arguments are passed to openWorkLog', async () => {
			const result = await Shift.openWorkLog();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', {});
			expect(result).toBeNull();
			expect(ShiftWorklogs.open).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
		});

		it('should return null when empty object is passed to openWorkLog', async () => {
			const result = await Shift.openWorkLog({});

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', {});
			expect(result).toBeNull();
			expect(ShiftWorklogs.open).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
		});

		it('should return null when null is passed to openWorkLog', async () => {
			const result = await Shift.openWorkLog(null);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('openWorkLog:', null);
			expect(result).toBeNull();
			expect(ShiftWorklogs.open).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
		});
	});

	describe('finishWorkLog', () => {
		it('should throw error when user does not have staff authorization', async () => {
			getStaffAuthorizationData.mockReturnValueOnce({hasStaffAuthorization: false});

			await expect(Shift.finishWorkLog({referenceId: 'test'})).rejects.toThrow(
				'Staff MS authorization is required'
			);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should finish worklog successfully', async () => {
			const mockShiftId = 'shift-123';
			const mockShiftStatus = 'opened';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			Storage.getString.mockReturnValueOnce(mockShiftStatus); // SHIFT_STATUS
			Storage.getString.mockReturnValueOnce(mockWorkLogId); // CURRENT_WORKLOG_ID

			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
			// expect(ShiftWorklogs.finish).toHaveBeenCalledWith({
			// 	referenceId: mockParams.referenceId,
			// 	endDate: mockDate.toISOString(),
			// });
			expect(OfflineData.save).toHaveBeenCalledWith(mockWorkLogId, {
				referenceId: mockParams.referenceId,
				endDate: mockDate.toISOString(),
			});
			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
				id: mockWorkLogId,
				time: mockDate.toISOString(),
				type: 'finish',
				payload: {
					type: mockParams.type,
					name: mockParams.name,
					shiftId: mockShiftId,
					referenceId: mockParams.referenceId,
				},
			});
			expect(Storage.delete).toHaveBeenCalledWith(CURRENT_WORKLOG_ID);
			expect(Storage.delete).toHaveBeenCalledWith(CURRENT_WORKLOG_DATA);
			expect(result).toBe(mockWorkLogId);
		});

		it('should finish worklog with default params', async () => {
			const mockShiftId = 'shift-123';
			const mockShiftStatus = 'opened';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			Storage.getString.mockReturnValueOnce(mockShiftStatus); // SHIFT_STATUS
			Storage.getString.mockReturnValueOnce(mockWorkLogId); // CURRENT_WORKLOG_ID

			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
			// expect(ShiftWorklogs.finish).toHaveBeenCalledWith({
			// 	referenceId: mockParams.referenceId,
			// 	endDate: mockDate.toISOString(),
			// });
			expect(OfflineData.save).toHaveBeenCalledWith(mockWorkLogId, {
				referenceId: mockParams.referenceId,
				endDate: mockDate.toISOString(),
			});
			expect(result).toBe(mockWorkLogId);
		});

		it('should handle OfflineData save errors', async () => {
			const error = new Error('OfflineData save failed');
			const mockShiftId = 'shift-123';
			const mockShiftStatus = 'opened';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			Storage.getString.mockReturnValueOnce(mockShiftStatus); // SHIFT_STATUS
			Storage.getString.mockReturnValueOnce(mockWorkLogId); // CURRENT_WORKLOG_ID
			OfflineData.save.mockImplementation(() => {
				throw error;
			});

			await expect(Shift.finishWorkLog(mockParams)).rejects.toThrow('OfflineData save failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
			// expect(ShiftWorklogs.finish).toHaveBeenCalled();
			expect(OfflineData.save).toHaveBeenCalledWith(mockWorkLogId, {
				referenceId: mockParams.referenceId,
				endDate: mockDate.toISOString(),
			});
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should continue even if TimeTracker fails', async () => {
			const mockShiftId = 'shift-123';
			const mockShiftStatus = 'opened';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			Storage.getString.mockReturnValueOnce(mockShiftStatus); // SHIFT_STATUS
			Storage.getString.mockReturnValueOnce(mockWorkLogId); // CURRENT_WORKLOG_ID

			TimeTracker.addEvent.mockRejectedValueOnce(new Error('TimeTracker failed'));

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
			// expect(ShiftWorklogs.finish).toHaveBeenCalled();
			expect(OfflineData.save).toHaveBeenCalledWith(mockWorkLogId, {
				referenceId: mockParams.referenceId,
				endDate: mockDate.toISOString(),
			});
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(Storage.delete).toHaveBeenCalledWith(CURRENT_WORKLOG_ID);
			expect(Storage.delete).toHaveBeenCalledWith(CURRENT_WORKLOG_DATA);
			expect(result).toBe(mockWorkLogId);
		});

		it('should resume shift when finishing worklog and shift is paused', async () => {
			const mockShiftId = 'shift-123';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			Storage.getString.mockReturnValueOnce('paused'); // shift status
			Storage.getString.mockReturnValueOnce(mockWorkLogId);

			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', mockParams);
			// expect(ShiftWorklogs.finish).toHaveBeenCalledWith({
			// 	referenceId: mockParams.referenceId,
			// 	endDate: mockDate.toISOString(),
			// });
			expect(OfflineData.save).toHaveBeenCalledWith(mockWorkLogId, {
				referenceId: mockParams.referenceId,
				endDate: mockDate.toISOString(),
			});
			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
				id: mockWorkLogId,
				time: mockDate.toISOString(),
				type: 'finish',
				payload: {
					type: mockParams.type,
					name: mockParams.name,
					shiftId: mockShiftId,
					referenceId: mockParams.referenceId,
				},
			});
			// Debe reanudar el turno cuando estaba pausado
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'opened');
			expect(Storage.delete).toHaveBeenCalledWith(CURRENT_WORKLOG_ID);
			expect(Storage.delete).toHaveBeenCalledWith(CURRENT_WORKLOG_DATA);
			expect(result).toBe(mockWorkLogId);
		});

		it('should handle missing worklog ID', async () => {
			const mockShiftId = 'shift-123';
			const mockShiftStatus = 'opened';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId); // SHIFT_ID
			Storage.getString.mockReturnValueOnce(mockShiftStatus); // SHIFT_STATUS
			Storage.getString.mockReturnValueOnce(undefined); // CURRENT_WORKLOG_ID

			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finishWorkLog(mockParams);

			// expect(ShiftWorklogs.finish).toHaveBeenCalled();
			expect(OfflineData.save).toHaveBeenCalledWith(undefined, {
				referenceId: mockParams.referenceId,
				endDate: mockDate.toISOString(),
			});
			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
				id: undefined,
				time: mockDate.toISOString(),
				type: 'finish',
				payload: expect.any(Object),
			});
			expect(Storage.delete).toHaveBeenCalledWith(CURRENT_WORKLOG_ID);
			expect(Storage.delete).toHaveBeenCalledWith(CURRENT_WORKLOG_DATA);
			expect(result).toBe(undefined);
		});

		it('should return null when no arguments are passed to finishWorkLog', async () => {
			const result = await Shift.finishWorkLog();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', {});
			expect(result).toBeNull();
			expect(ShiftWorklogs.finish).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
			expect(Storage.delete).not.toHaveBeenCalled();
		});

		it('should return null when empty object is passed to finishWorkLog', async () => {
			const result = await Shift.finishWorkLog({});

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', {});
			expect(result).toBeNull();
			expect(ShiftWorklogs.finish).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
			expect(Storage.delete).not.toHaveBeenCalled();
		});

		it('should return null when null is passed to finishWorkLog', async () => {
			const result = await Shift.finishWorkLog(null);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('finishWorkLog:', null);
			expect(result).toBeNull();
			expect(ShiftWorklogs.finish).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
			expect(Storage.delete).not.toHaveBeenCalled();
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

	describe('getReport', () => {
		it('should get shift report successfully with all data', async () => {
			const mockShiftId = 'shift-123';
			const mockStartDate = '2024-01-15T09:00:00.000Z';
			const mockEndDate = '2024-01-15T17:00:00.000Z';
			const mockElapsedTime = 28800000; // 8 horas en milisegundos

			// pauseTime ahora incluye todas las actividades: 7200000 (trabajo) + 1800000 (pausa) = 9000000 milisegundos
			const mockPauseTime = 9000000;
			const mockWorkTime = mockElapsedTime - mockPauseTime;

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.getShiftTrackedWorkLogs.mockResolvedValueOnce(mockWorkLogsEvents);
			TrackerRecords.getStartDateById.mockResolvedValueOnce(mockStartDate);
			TrackerRecords.getEndDateById.mockResolvedValueOnce(mockEndDate);
			Formatter.formatShiftActivities.mockReturnValueOnce(mockFormattedActivities);
			TimeTracker.getElapsedTime.mockReturnValueOnce(mockElapsedTime);

			const result = await Shift.getReport();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user get shift report');
			expect(Storage.getString).toHaveBeenCalledWith(SHIFT_ID);
			expect(ShiftWorklogs.getShiftTrackedWorkLogs).toHaveBeenCalledWith(mockShiftId);
			expect(TrackerRecords.getStartDateById).toHaveBeenCalledWith(mockShiftId);
			expect(TrackerRecords.getEndDateById).toHaveBeenCalledWith(mockShiftId);
			expect(Formatter.formatShiftActivities).toHaveBeenCalledWith(mockWorkLogsEvents);
			expect(TimeTracker.getElapsedTime).toHaveBeenCalledWith({
				startTime: mockStartDate,
				endTime: mockEndDate,
				format: false,
			});

			expect(result).toEqual({
				activities: mockFormattedActivities,
				startDate: mockStartDate,
				endDate: mockEndDate,
				elapsedTime: mockElapsedTime,
				workTime: mockWorkTime,
				pauseTime: mockPauseTime,
			});
		});

		it('should get shift report without end date', async () => {
			const mockShiftId = 'shift-123';
			const mockStartDate = '2024-01-15T09:00:00.000Z';
			const mockElapsedTime = 14400000; // 4 horas en milisegundos

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.getShiftTrackedWorkLogs.mockResolvedValueOnce(mockWorkLogsEvents);
			TrackerRecords.getStartDateById.mockResolvedValueOnce(mockStartDate);
			TrackerRecords.getEndDateById.mockResolvedValueOnce(null);
			Formatter.formatShiftActivities.mockReturnValueOnce(mockFormattedActivities);
			TimeTracker.getElapsedTime.mockReturnValueOnce(mockElapsedTime);

			const result = await Shift.getReport();

			expect(TimeTracker.getElapsedTime).toHaveBeenCalledWith({
				startTime: mockStartDate,
				format: false,
			});

			// pauseTime ahora incluye todas las actividades: 7200000 (trabajo) + 1800000 (pausa) = 9000000 milisegundos
			const expectedPauseTime = 9000000;
			const expectedWorkTime = mockElapsedTime - expectedPauseTime;

			expect(result).toEqual({
				activities: mockFormattedActivities,
				startDate: mockStartDate,
				endDate: null,
				elapsedTime: mockElapsedTime,
				workTime: expectedWorkTime,
				pauseTime: expectedPauseTime,
			});
		});

		it('should calculate pause time correctly from activities', async () => {
			const mockShiftId = 'shift-123';
			const mockStartDate = '2024-01-15T09:00:00.000Z';
			const mockEndDate = '2024-01-15T17:00:00.000Z';
			const mockElapsedTime = 28800000; // 8 horas en milisegundos

			const activitiesWithVariousTypes = [
				{
					type: 'work',
					name: 'Trabajo Principal',
					startTime: '2024-01-15T10:00:00.000Z',
					endTime: '2024-01-15T12:00:00.000Z',
					duration: 7200000, // 2 horas en milisegundos
				},
				{
					type: 'pause',
					name: 'Pausa 1',
					startTime: '2024-01-15T12:00:00.000Z',
					endTime: '2024-01-15T12:30:00.000Z',
					duration: 1800000, // 30 minutos en milisegundos
				},
				{
					type: 'pause',
					name: 'Pausa 2',
					startTime: '2024-01-15T14:00:00.000Z',
					endTime: '2024-01-15T14:15:00.000Z',
					duration: 900000, // 15 minutos en milisegundos
				},
				{
					type: 'work',
					name: 'Trabajo Secundario',
					startTime: '2024-01-15T12:00:00.000Z',
					endTime: '2024-01-15T14:00:00.000Z',
				},
			];

			// Ahora pauseTime incluye TODAS las actividades, no solo las de tipo 'pause'
			const expectedPauseTime = 9900000; // 7200000 + 1800000 + 900000 = 9900000 milisegundos total
			const expectedWorkTime = mockElapsedTime - expectedPauseTime;

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.getShiftTrackedWorkLogs.mockResolvedValueOnce(mockWorkLogsEvents);
			TrackerRecords.getStartDateById.mockResolvedValueOnce(mockStartDate);
			TrackerRecords.getEndDateById.mockResolvedValueOnce(mockEndDate);
			Formatter.formatShiftActivities.mockReturnValueOnce(activitiesWithVariousTypes);
			TimeTracker.getElapsedTime.mockReturnValueOnce(mockElapsedTime);

			const result = await Shift.getReport();

			expect(result.pauseTime).toBe(expectedPauseTime);
			expect(result.workTime).toBe(expectedWorkTime);
			expect(result.elapsedTime).toBe(mockElapsedTime);
		});

		it('should handle missing shift ID', async () => {
			Storage.getString.mockReturnValueOnce(null);

			await expect(Shift.getReport()).rejects.toThrow('Shift ID is required');

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user get shift report');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should handle empty shift ID', async () => {
			Storage.getString.mockReturnValueOnce('');

			await expect(Shift.getReport()).rejects.toThrow('Shift ID is required');

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user get shift report');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should handle activities with only work type', async () => {
			const mockShiftId = 'shift-123';
			const mockStartDate = '2024-01-15T09:00:00.000Z';
			const mockEndDate = '2024-01-15T17:00:00.000Z';
			const mockElapsedTime = 28800000; // 8 horas en milisegundos

			const activitiesWithOnlyWork = [
				{
					type: 'work',
					name: 'Trabajo Principal',
					startTime: '2024-01-15T10:00:00.000Z',
					endTime: '2024-01-15T12:00:00.000Z',
					duration: 7200000, // 2 horas en milisegundos
				},
				{
					type: 'work',
					name: 'Trabajo Secundario',
					startTime: '2024-01-15T12:00:00.000Z',
					endTime: '2024-01-15T14:00:00.000Z',
					duration: 7200000, // 2 horas en milisegundos
				},
			];

			// pauseTime ahora incluye todas las actividades: 7200000 + 7200000 = 14400000 milisegundos
			const expectedPauseTime = 14400000;
			const expectedWorkTime = mockElapsedTime - expectedPauseTime;

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.getShiftTrackedWorkLogs.mockResolvedValueOnce(mockWorkLogsEvents);
			TrackerRecords.getStartDateById.mockResolvedValueOnce(mockStartDate);
			TrackerRecords.getEndDateById.mockResolvedValueOnce(mockEndDate);
			Formatter.formatShiftActivities.mockReturnValueOnce(activitiesWithOnlyWork);
			TimeTracker.getElapsedTime.mockReturnValueOnce(mockElapsedTime);

			const result = await Shift.getReport();

			expect(result.pauseTime).toBe(expectedPauseTime);
			expect(result.workTime).toBe(expectedWorkTime);
			expect(result.elapsedTime).toBe(mockElapsedTime);
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
			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.getList.mockResolvedValueOnce(mockWorkLogsRaw);
			Formatter.formatWorkLogsFromJanis.mockReturnValueOnce(mockWorkLogs);

			const result = await Shift.getWorkLogs();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('getWorkLogs:');
			expect(Storage.getString).toHaveBeenCalledWith(SHIFT_ID);
			expect(ShiftWorklogs.getList).toHaveBeenCalledWith(mockShiftId);
			expect(Formatter.formatWorkLogsFromJanis).toHaveBeenCalledWith(mockWorkLogsRaw);
			expect(result).toEqual(mockWorkLogs);
		});

		it('should throw error when shiftId is not found', async () => {
			Storage.getString.mockReturnValueOnce(undefined);

			await expect(Shift.getWorkLogs()).rejects.toThrow('Shift ID not found');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('getWorkLogs:');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
			expect(ShiftWorklogs.getList).not.toHaveBeenCalled();
		});
	});

	describe('isDateToCloseExceeded', () => {
		it('should return false when dateToClose is not exceeded', () => {
			const storageData = {
				dateToClose: '2024-01-15T18:00:00.000Z', // Fecha futura (7.5 horas después del mockDate)
			};

			getObject.mockReturnValueOnce(storageData);

			const result = Shift.isDateToCloseExceeded();

			expect(result).toBe(false);
		});

		it('should return true when dateToClose is exceeded', () => {
			const storageData = {
				dateToClose: '2024-01-15T08:00:00.000Z', // Fecha pasada (2.5 horas antes del mockDate)
			};

			getObject.mockReturnValueOnce(storageData);

			const result = Shift.isDateToCloseExceeded();

			expect(result).toBe(true);
		});
	});

	describe('isDateMaxToCloseExceeded', () => {
		it('should return false when dateMaxToClose is not exceeded', () => {
			const storageData = {
				dateMaxToClose: '2024-01-15T20:00:00.000Z', // Fecha futura (9.5 horas después del mockDate)
			};

			getObject.mockReturnValueOnce(storageData);

			const result = Shift.isDateMaxToCloseExceeded();

			expect(result).toBe(false);
		});

		it('should return true when dateMaxToClose is exceeded', () => {
			const storageData = {
				dateMaxToClose: '2024-01-15T09:00:00.000Z', // Fecha pasada (1.5 horas antes del mockDate)
			};

			getObject.mockReturnValueOnce(storageData);

			const result = Shift.isDateMaxToCloseExceeded();

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
			jest.spyOn(Shift, 'isDateToCloseExceeded').mockReturnValueOnce(false);

			getObject.mockReturnValueOnce(mockShiftData);
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			Formatter.formatOfflineWorkLog.mockReturnValueOnce(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.postPendingBatch.mockResolvedValueOnce(null);

			const result = await Shift.sendPendingWorkLogs();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('sendPendingWorkLogs:');
			expect(mockOfflineData.get).toHaveBeenCalled();
			expect(Formatter.formatOfflineWorkLog).toHaveBeenCalledWith(mockPendingWorkLogs);
			expect(ShiftWorklogs.postPendingBatch).toHaveBeenCalledWith(mockFormattedOfflineWorkLogs);
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();
			expect(result).toBe(null);
		});

		it('should reopen a shift if it is expired before to send pending worklogs', async () => {
			jest.spyOn(Shift, 'isDateToCloseExceeded').mockReturnValueOnce(true);
			jest.spyOn(Shift, 'isDateMaxToCloseExceeded').mockReturnValueOnce(false);

			getObject.mockReturnValueOnce(mockShiftData);
			getObject.mockReturnValueOnce(mockShiftData);
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			Formatter.formatOfflineWorkLog.mockReturnValueOnce(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.postPendingBatch.mockResolvedValueOnce(null);

			const result = await Shift.sendPendingWorkLogs();

			expect(mockOfflineData.get).toHaveBeenCalled();
			expect(Formatter.formatOfflineWorkLog).toHaveBeenCalledWith(mockPendingWorkLogs);
			expect(ShiftWorklogs.postPendingBatch).toHaveBeenCalledWith(mockFormattedOfflineWorkLogs);
			expect(mockOfflineData.deleteAll).toHaveBeenCalled();
			expect(result).toBe(null);
		});

		it('should return null when no data to send', async () => {
			mockOfflineData.get.mockReturnValueOnce([]);
			Formatter.formatOfflineWorkLog.mockReturnValueOnce([]);

			const result = await Shift.sendPendingWorkLogs();

			expect(mockOfflineData.get).toHaveBeenCalled();
			expect(Formatter.formatOfflineWorkLog).toHaveBeenCalledWith([]);
			expect(ShiftWorklogs.postPendingBatch).not.toHaveBeenCalled();
			expect(mockOfflineData.deleteAll).not.toHaveBeenCalled();
			expect(result).toBe(null);
		});

		it('should handle sendPendingWorkLogs error', async () => {
			jest.spyOn(Shift, 'isDateToCloseExceeded').mockReturnValueOnce(false);

			const error = new Error('Send pending worklogs failed');
			getObject.mockReturnValueOnce(mockShiftData);
			mockOfflineData.get.mockReturnValueOnce(mockPendingWorkLogs);
			Formatter.formatOfflineWorkLog.mockReturnValueOnce(mockFormattedOfflineWorkLogs);
			ShiftWorklogs.postPendingBatch.mockRejectedValueOnce(error);

			await expect(Shift.sendPendingWorkLogs()).rejects.toThrow('Send pending worklogs failed');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
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
			jest.spyOn(Shift, 'isDateMaxToCloseExceeded').mockReturnValueOnce(false);
			getObject.mockReturnValueOnce({...storageData, reopeningExtensionTime: 1});
			StaffService.openShift.mockResolvedValueOnce({});

			const result = await Shift.reOpen();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('reOpenShift:');
			expect(Shift.isDateMaxToCloseExceeded).toHaveBeenCalled();
			expect(StaffService.openShift).toHaveBeenCalled();
			expect(result).toBe(null);
		});

		it('should reject when max close deadline is exceeded', async () => {
			// Mock isDateMaxToCloseExceeded to return true (expired)
			jest.spyOn(Shift, 'isDateMaxToCloseExceeded').mockReturnValueOnce(true);
			getObject.mockReturnValueOnce(storageData);

			await expect(Shift.reOpen()).rejects.toThrow(
				'The deadline for ending the shift has been exceeded'
			);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('reOpenShift:');
			expect(Shift.isDateMaxToCloseExceeded).toHaveBeenCalled();
			expect(StaffService.openShift).not.toHaveBeenCalled();
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should handle reOpen error', async () => {
			const error = new Error('Reopen shift failed');
			jest.spyOn(Shift, 'isDateMaxToCloseExceeded').mockReturnValueOnce(false);
			getObject.mockReturnValueOnce(storageData);
			StaffService.openShift.mockRejectedValueOnce(error);

			await expect(Shift.reOpen()).rejects.toThrow('Reopen shift failed');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});
	});
});
