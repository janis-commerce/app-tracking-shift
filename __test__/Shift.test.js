import Shift from '../lib/Shift';
import {worklogTypes, parsedWorklogTypes} from '../__mocks__/worklogTypes';
import {
	mockCrashlytics,
	mockShiftData,
	mockWorkLogsEvents,
	mockFormattedActivities,
} from '../__mocks__';
import StaffService from '../lib/StaffApiServices';
import TimeTracker from '../lib/db/TimeTrackerService';
import Formatter from '../lib/Formatter';
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
import {getShiftData} from '../lib/utils/storage';

// Mock para Date
const mockDate = new Date('2024-01-15T10:30:00.000Z');
const realDate = Date;

describe('Shift', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.Date = jest.fn(() => mockDate);
		global.Date.prototype = realDate.prototype;
		global.Date.now = jest.fn(() => mockDate.getTime());
		global.Date.toISOString = jest.fn(() => mockDate.toISOString());
	});

	afterEach(() => {
		global.Date = realDate;
	});

	describe('open', () => {
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
		it('should finish a shift successfully', async () => {
			const mockShiftId = 'shift-999';
			const expectedUpdatedShiftData = {
				...mockShiftData,
				id: mockShiftId,
				endDate: mockDate.toISOString(),
			};

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			getShiftData.mockReturnValueOnce({...mockShiftData, id: mockShiftId});
			TimeTracker.addEvent.mockResolvedValueOnce();

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

		it('should finish a shift with specific date', async () => {
			const mockShiftId = 'shift-888';
			const specificDate = '2024-01-15T18:00:00.000Z';
			const expectedUpdatedShiftData = {
				...mockShiftData,
				id: mockShiftId,
				endDate: specificDate,
			};

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
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

			StaffService.closeShift.mockResolvedValueOnce({
				result: undefined,
			});
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

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
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
		it('should get user open shift successfully', async () => {
			const mockShift = {id: 'shift-123', status: 'opened'};
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [mockShift],
			});

			const result = await Shift.getUserOpenShift({userId: 'user-123', id: 'shift-123'});

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

			expect(mockCrashlytics.log).toHaveBeenCalled();
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
		it('should open worklog successfully and pause shift for normal activities', async () => {
			const mockShiftId = 'shift-123';
			const mockWorkLogId = 'worklog-456';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				suggestedTime: 30,
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.open.mockResolvedValueOnce(mockWorkLogId);
			TimeTracker.addEvent.mockResolvedValueOnce();
			Formatter.formatWorkLogId.mockReturnValueOnce(mockFormattedId);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog', mockParams);
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			expect(ShiftWorklogs.open).toHaveBeenCalledWith({
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
			expect(result).toEqual(mockFormattedId);
		});

		it('should open excluded worklog types without pausing shift', async () => {
			const mockShiftId = 'shift-123';
			const mockWorkLogId = 'worklog-456';
			const mockFormattedId = 'picking-mock-random-id';
			const mockParams = {
				referenceId: EXCLUDED_WORKLOG_TYPES[0], // 'default-picking-work'
				name: 'Picking Work',
				type: 'work',
				suggestedTime: 30,
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.open.mockResolvedValueOnce(mockWorkLogId);
			TimeTracker.addEvent.mockResolvedValueOnce();
			Formatter.formatWorkLogId.mockReturnValueOnce(mockFormattedId);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog', mockParams);
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			expect(ShiftWorklogs.open).toHaveBeenCalledWith({
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
			ShiftWorklogs.open.mockResolvedValueOnce('worklog-id');
			TimeTracker.addEvent.mockResolvedValueOnce();
			Formatter.formatWorkLogId.mockReturnValueOnce(mockFormattedId);

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog', mockParams);
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			expect(ShiftWorklogs.open).toHaveBeenCalledWith({
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'paused');
			expect(result).toEqual(mockFormattedId);
		});

		it('should handle ShiftWorklogs.open errors', async () => {
			const error = new Error('ShiftWorklogs open failed');
			const mockShiftId = 'shift-123';
			const mockFormattedId = 'ref-123-mock-random-id';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			Formatter.formatWorkLogId.mockReturnValueOnce(mockFormattedId);
			ShiftWorklogs.open.mockRejectedValueOnce(error);

			await expect(Shift.openWorkLog(mockParams)).rejects.toThrow('ShiftWorklogs open failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog', mockParams);
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
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
			ShiftWorklogs.open.mockResolvedValueOnce('worklog-id');
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('TimeTracker failed'));

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog', mockParams);
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			expect(ShiftWorklogs.open).toHaveBeenCalled();
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
			ShiftWorklogs.open.mockResolvedValueOnce('worklog-id');
			TimeTracker.addEvent.mockResolvedValueOnce();

			await Shift.openWorkLog(mockParams);

			const expectedFinishDate = new Date(mockDate.getTime() + 15 * 60 * 1000).toISOString();
			expect(Formatter.formatWorkLogId).toHaveBeenCalled();
			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'paused');
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				JSON.stringify({
					type: mockParams.type,
					name: mockParams.name,
					shiftId: mockShiftId,
					referenceId: mockParams.referenceId,
					suggestedFinishDate: expectedFinishDate,
					suggestedTime: 15,
				})
			);
		});

		it('should return null when no arguments are passed to openWorkLog', async () => {
			const result = await Shift.openWorkLog();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog', {});
			expect(result).toBeNull();
			expect(ShiftWorklogs.open).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
		});

		it('should return null when empty object is passed to openWorkLog', async () => {
			const result = await Shift.openWorkLog({});

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog', {});
			expect(result).toBeNull();
			expect(ShiftWorklogs.open).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
		});

		it('should return null when null is passed to openWorkLog', async () => {
			const result = await Shift.openWorkLog(null);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog', null);
			expect(result).toBeNull();
			expect(ShiftWorklogs.open).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
		});
	});

	describe('finishWorkLog', () => {
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
			ShiftWorklogs.finish.mockResolvedValueOnce(mockWorkLogId);
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog', mockParams);
			expect(ShiftWorklogs.finish).toHaveBeenCalledWith({
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
			ShiftWorklogs.finish.mockResolvedValueOnce(mockWorkLogId);
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog', mockParams);
			expect(ShiftWorklogs.finish).toHaveBeenCalledWith({
				referenceId: mockParams.referenceId,
				endDate: mockDate.toISOString(),
			});
			expect(result).toBe(mockWorkLogId);
		});

		it('should handle ShiftWorklogs.finish errors', async () => {
			const error = new Error('ShiftWorklogs finish failed');
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
			ShiftWorklogs.finish.mockRejectedValueOnce(error);

			await expect(Shift.finishWorkLog(mockParams)).rejects.toThrow('ShiftWorklogs finish failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog', mockParams);
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
			ShiftWorklogs.finish.mockResolvedValueOnce(mockWorkLogId);
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('TimeTracker failed'));

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog', mockParams);
			expect(ShiftWorklogs.finish).toHaveBeenCalled();
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
			ShiftWorklogs.finish.mockResolvedValueOnce(mockWorkLogId);
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog', mockParams);
			expect(ShiftWorklogs.finish).toHaveBeenCalledWith({
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
			ShiftWorklogs.finish.mockResolvedValueOnce('new-worklog-id');
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finishWorkLog(mockParams);

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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog', {});
			expect(result).toBeNull();
			expect(ShiftWorklogs.finish).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
			expect(Storage.delete).not.toHaveBeenCalled();
		});

		it('should return null when empty object is passed to finishWorkLog', async () => {
			const result = await Shift.finishWorkLog({});

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog', {});
			expect(result).toBeNull();
			expect(ShiftWorklogs.finish).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
			expect(Storage.delete).not.toHaveBeenCalled();
		});

		it('should return null when null is passed to finishWorkLog', async () => {
			const result = await Shift.finishWorkLog(null);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog', null);
			expect(result).toBeNull();
			expect(ShiftWorklogs.finish).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
			expect(Storage.delete).not.toHaveBeenCalled();
		});
	});

	describe('getShiftReport', () => {
		it('should get shift report successfully with all data', async () => {
			const mockShiftId = 'shift-123';
			const mockStartDate = '2024-01-15T09:00:00.000Z';
			const mockEndDate = '2024-01-15T17:00:00.000Z';
			const mockElapsedTime = 28800; // 8 horas en segundos
			const mockPauseTime = 1800; // 30 minutos en segundos
			const mockWorkTime = mockElapsedTime - mockPauseTime;

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.getShiftTrackedWorkLogs.mockResolvedValueOnce(mockWorkLogsEvents);
			TrackerRecords.getStartDateById.mockResolvedValueOnce(mockStartDate);
			TrackerRecords.getEndDateById.mockResolvedValueOnce(mockEndDate);
			Formatter.formatShiftActivities.mockReturnValueOnce(mockFormattedActivities);
			TimeTracker.getElapsedTime.mockReturnValueOnce(mockElapsedTime);

			const result = await Shift.getShiftReport();

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
			const mockElapsedTime = 14400; // 4 horas en segundos

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.getShiftTrackedWorkLogs.mockResolvedValueOnce(mockWorkLogsEvents);
			TrackerRecords.getStartDateById.mockResolvedValueOnce(mockStartDate);
			TrackerRecords.getEndDateById.mockResolvedValueOnce(null);
			Formatter.formatShiftActivities.mockReturnValueOnce(mockFormattedActivities);
			TimeTracker.getElapsedTime.mockReturnValueOnce(mockElapsedTime);

			const result = await Shift.getShiftReport();

			expect(TimeTracker.getElapsedTime).toHaveBeenCalledWith({
				startTime: mockStartDate,
				format: false,
			});

			// Calculamos el pauseTime basado en las actividades mockeadas
			const expectedPauseTime = mockFormattedActivities.reduce((acc, activity) => {
				if (activity?.type === 'pause') return acc + (activity?.duration || 0);
				return acc;
			}, 0);
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
			const mockElapsedTime = 28800; // 8 horas en segundos

			const activitiesWithPauses = [
				{
					type: 'work',
					name: 'Trabajo Principal',
					startTime: '2024-01-15T10:00:00.000Z',
					endTime: '2024-01-15T12:00:00.000Z',
					duration: 7200,
				},
				{
					type: 'pause',
					name: 'Pausa 1',
					startTime: '2024-01-15T12:00:00.000Z',
					endTime: '2024-01-15T12:30:00.000Z',
					duration: 1800, // 30 minutos
				},
				{
					type: 'pause',
					name: 'Pausa 2',
					startTime: '2024-01-15T14:00:00.000Z',
					endTime: '2024-01-15T14:15:00.000Z',
					duration: 900, // 15 minutos
				},
			];

			const expectedPauseTime = 2700; // 45 minutos total
			const expectedWorkTime = mockElapsedTime - expectedPauseTime;

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.getShiftTrackedWorkLogs.mockResolvedValueOnce(mockWorkLogsEvents);
			TrackerRecords.getStartDateById.mockResolvedValueOnce(mockStartDate);
			TrackerRecords.getEndDateById.mockResolvedValueOnce(mockEndDate);
			Formatter.formatShiftActivities.mockReturnValueOnce(activitiesWithPauses);
			TimeTracker.getElapsedTime.mockReturnValueOnce(mockElapsedTime);

			const result = await Shift.getShiftReport();

			expect(result.pauseTime).toBe(expectedPauseTime);
			expect(result.workTime).toBe(expectedWorkTime);
			expect(result.elapsedTime).toBe(mockElapsedTime);
		});

		it('should handle missing shift ID', async () => {
			Storage.getString.mockReturnValueOnce(null);

			await expect(Shift.getShiftReport()).rejects.toThrow('Shift ID is required');

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user get shift report');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should handle empty shift ID', async () => {
			Storage.getString.mockReturnValueOnce('');

			await expect(Shift.getShiftReport()).rejects.toThrow('Shift ID is required');

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user get shift report');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should handle activities without pause time', async () => {
			const mockShiftId = 'shift-123';
			const mockStartDate = '2024-01-15T09:00:00.000Z';
			const mockEndDate = '2024-01-15T17:00:00.000Z';
			const mockElapsedTime = 28800; // 8 horas en segundos

			const activitiesWithoutPauses = [
				{
					type: 'work',
					name: 'Trabajo Principal',
					startTime: '2024-01-15T10:00:00.000Z',
					endTime: '2024-01-15T12:00:00.000Z',
					duration: 7200,
				},
				{
					type: 'work',
					name: 'Trabajo Secundario',
					startTime: '2024-01-15T12:00:00.000Z',
					endTime: '2024-01-15T14:00:00.000Z',
					duration: 7200,
				},
			];

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.getShiftTrackedWorkLogs.mockResolvedValueOnce(mockWorkLogsEvents);
			TrackerRecords.getStartDateById.mockResolvedValueOnce(mockStartDate);
			TrackerRecords.getEndDateById.mockResolvedValueOnce(mockEndDate);
			Formatter.formatShiftActivities.mockReturnValueOnce(activitiesWithoutPauses);
			TimeTracker.getElapsedTime.mockReturnValueOnce(mockElapsedTime);

			const result = await Shift.getShiftReport();

			expect(result.pauseTime).toBe(0);
			expect(result.workTime).toBe(mockElapsedTime);
			expect(result.elapsedTime).toBe(mockElapsedTime);
		});
	});
});
