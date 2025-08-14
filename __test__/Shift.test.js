import Shift from '../lib/Shift';
import {worklogTypes, parsedWorklogTypes} from '../__mocks__/worklogTypes';
import {mockCrashlytics} from '../__mocks__';
import StaffService from '../lib/StaffApiServices';
import TimeTracker from '../lib/db/TimeTrackerService';
import {
	SHIFT_STATUS,
	SHIFT_ID,
	SHIFT_DATA,
	CURRENT_WORKLOG_ID,
	CURRENT_WORKLOG_DATA,
} from '../lib/constant';
import Storage from '../lib/db/StorageService';
import ShiftWorklogs from '../lib/ShiftWorklogs';

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
			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finish();

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.delete).toHaveBeenCalledWith(SHIFT_ID);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should finish a shift with specific date', async () => {
			const mockShiftId = 'shift-888';
			const specificDate = '2024-01-15T18:00:00.000Z';

			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finish({date: specificDate});

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.delete).toHaveBeenCalledWith(SHIFT_ID);
			expect(mockCrashlytics.log).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should handle response with result but without id', async () => {
			const specificDate = '2024-01-15T18:00:00.000Z';

			StaffService.closeShift.mockResolvedValueOnce({
				result: undefined,
			});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finish({date: specificDate});

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.delete).toHaveBeenCalledWith(SHIFT_ID);
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
			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('Tracking failed'));

			const result = await Shift.finish();

			expect(Storage.set).toHaveBeenCalledWith(SHIFT_STATUS, 'closed');
			expect(Storage.delete).toHaveBeenCalledWith(SHIFT_ID);
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
			ShiftWorklogs.prepareWorkLogTypes.mockReturnValueOnce(parsedWorklogTypes);

			const result = await Shift.fetchWorklogTypes();

			expect(StaffService.getWorkLogTypes).toHaveBeenCalled();
			expect(ShiftWorklogs.prepareWorkLogTypes).toHaveBeenCalledWith(worklogTypes);
			expect(result).toEqual(parsedWorklogTypes);
		});

		it('should handle empty worklog types response', async () => {
			StaffService.getWorkLogTypes.mockResolvedValueOnce({
				result: undefined,
			});
			ShiftWorklogs.prepareWorkLogTypes.mockReturnValueOnce([]);

			const result = await Shift.fetchWorklogTypes();

			expect(ShiftWorklogs.prepareWorkLogTypes).toHaveBeenCalledWith([]);
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
			ShiftWorklogs.prepareWorkLogTypes.mockReturnValueOnce(expectedFiltered);

			const result = await Shift.fetchWorklogTypes();

			expect(ShiftWorklogs.prepareWorkLogTypes).toHaveBeenCalledWith(mockWorklogTypes);
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
		it('should open worklog successfully', async () => {
			const mockShiftId = 'shift-123';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				suggestedTime: 30,
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.open.mockResolvedValueOnce(mockWorkLogId);
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog');
			expect(ShiftWorklogs.open).toHaveBeenCalledWith({
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
				id: expect.any(String),
				time: mockDate.toISOString(),
				type: 'start',
				payload: {
					type: mockParams.type,
					name: mockParams.name,
					shiftId: mockShiftId,
					referenceId: mockParams.referenceId,
				},
			});
			expect(Storage.set).toHaveBeenCalledWith(CURRENT_WORKLOG_ID, expect.any(String));
			expect(Storage.set).toHaveBeenCalledWith(
				CURRENT_WORKLOG_DATA,
				expect.stringContaining(mockParams.type)
			);
			expect(result).toEqual(expect.any(String));
		});

		it('should open worklog with default params', async () => {
			const mockShiftId = 'shift-123';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.open.mockResolvedValueOnce('worklog-id');
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog');
			expect(ShiftWorklogs.open).toHaveBeenCalledWith({
				referenceId: mockParams.referenceId,
				startDate: mockDate.toISOString(),
			});
			expect(result).toEqual(expect.any(String));
		});

		it('should handle ShiftWorklogs.open errors', async () => {
			const error = new Error('ShiftWorklogs open failed');
			const mockShiftId = 'shift-123';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.open.mockRejectedValueOnce(error);

			await expect(Shift.openWorkLog(mockParams)).rejects.toThrow('ShiftWorklogs open failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should continue even if TimeTracker fails', async () => {
			const mockShiftId = 'shift-123';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.open.mockResolvedValueOnce('worklog-id');
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('TimeTracker failed'));

			const result = await Shift.openWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog');
			expect(ShiftWorklogs.open).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toEqual(expect.any(String));
		});

		it('should calculate suggested finish date correctly', async () => {
			const mockShiftId = 'shift-123';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
				suggestedTime: 15, // 15 minutos
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			ShiftWorklogs.open.mockResolvedValueOnce('worklog-id');
			TimeTracker.addEvent.mockResolvedValueOnce();

			await Shift.openWorkLog(mockParams);

			const expectedFinishDate = new Date(mockDate.getTime() + 15 * 60 * 1000).toISOString();
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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog');
			expect(result).toBeNull();
			expect(ShiftWorklogs.open).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
		});

		it('should return null when empty object is passed to openWorkLog', async () => {
			const result = await Shift.openWorkLog({});

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog');
			expect(result).toBeNull();
			expect(ShiftWorklogs.open).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
		});

		it('should return null when null is passed to openWorkLog', async () => {
			const result = await Shift.openWorkLog(null);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift worklog');
			expect(result).toBeNull();
			expect(ShiftWorklogs.open).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
		});
	});

	describe('finishWorkLog', () => {
		it('should finish worklog successfully', async () => {
			const mockShiftId = 'shift-123';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			Storage.getString.mockReturnValueOnce(mockWorkLogId);
			ShiftWorklogs.finish.mockResolvedValueOnce(mockWorkLogId);
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog');
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
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			Storage.getString.mockReturnValueOnce(mockWorkLogId);
			ShiftWorklogs.finish.mockResolvedValueOnce(mockWorkLogId);
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog');
			expect(ShiftWorklogs.finish).toHaveBeenCalledWith({
				referenceId: mockParams.referenceId,
				endDate: mockDate.toISOString(),
			});
			expect(result).toBe(mockWorkLogId);
		});

		it('should handle ShiftWorklogs.finish errors', async () => {
			const error = new Error('ShiftWorklogs finish failed');
			const mockShiftId = 'shift-123';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			Storage.getString.mockReturnValueOnce(mockWorkLogId);
			ShiftWorklogs.finish.mockRejectedValueOnce(error);

			await expect(Shift.finishWorkLog(mockParams)).rejects.toThrow('ShiftWorklogs finish failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});

		it('should continue even if TimeTracker fails', async () => {
			const mockShiftId = 'shift-123';
			const mockWorkLogId = 'worklog-456';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			Storage.getString.mockReturnValueOnce(mockWorkLogId);
			ShiftWorklogs.finish.mockResolvedValueOnce(mockWorkLogId);
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('TimeTracker failed'));

			const result = await Shift.finishWorkLog(mockParams);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog');
			expect(ShiftWorklogs.finish).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(Storage.delete).toHaveBeenCalledWith(CURRENT_WORKLOG_ID);
			expect(Storage.delete).toHaveBeenCalledWith(CURRENT_WORKLOG_DATA);
			expect(result).toBe(mockWorkLogId);
		});

		it('should handle missing worklog ID', async () => {
			const mockShiftId = 'shift-123';
			const mockParams = {
				referenceId: 'ref-123',
				name: 'Test Work',
				type: 'work',
			};

			Storage.getString.mockReturnValueOnce(mockShiftId);
			Storage.getString.mockReturnValueOnce(undefined);
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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog');
			expect(result).toBeNull();
			expect(ShiftWorklogs.finish).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
			expect(Storage.delete).not.toHaveBeenCalled();
		});

		it('should return null when empty object is passed to finishWorkLog', async () => {
			const result = await Shift.finishWorkLog({});

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog');
			expect(result).toBeNull();
			expect(ShiftWorklogs.finish).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
			expect(Storage.delete).not.toHaveBeenCalled();
		});

		it('should return null when null is passed to finishWorkLog', async () => {
			const result = await Shift.finishWorkLog(null);

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift worklog');
			expect(result).toBeNull();
			expect(ShiftWorklogs.finish).not.toHaveBeenCalled();
			expect(TimeTracker.addEvent).not.toHaveBeenCalled();
			expect(Storage.set).not.toHaveBeenCalled();
			expect(Storage.delete).not.toHaveBeenCalled();
		});
	});

	describe('checkStaffMSAuthorization', () => {
		it('should return true when user is authorized', async () => {
			StaffService.getStaffMSAuthorization.mockResolvedValueOnce({
				result: true,
			});

			const result = await Shift.checkStaffMSAuthorization();

			expect(StaffService.getStaffMSAuthorization).toHaveBeenCalled();
			expect(result).toBe(true);
		});

		it('should return false when result is undefined', async () => {
			StaffService.getStaffMSAuthorization.mockResolvedValueOnce({
				result: undefined,
			});

			const result = await Shift.checkStaffMSAuthorization();

			expect(StaffService.getStaffMSAuthorization).toHaveBeenCalled();
			expect(result).toBe(false);
		});

		it('should return false when response has no result property', async () => {
			StaffService.getStaffMSAuthorization.mockResolvedValueOnce({});

			const result = await Shift.checkStaffMSAuthorization();

			expect(StaffService.getStaffMSAuthorization).toHaveBeenCalled();
			expect(result).toBe(false);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('Authorization check failed');
			StaffService.getStaffMSAuthorization.mockRejectedValueOnce(error);

			await expect(Shift.checkStaffMSAuthorization()).rejects.toThrow('Authorization check failed');
			expect(mockCrashlytics.recordError).toHaveBeenCalled();
		});
	});
});
