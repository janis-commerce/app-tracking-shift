import Shift from '../lib/Shift';
import {worklogTypes, parsedWorklogTypes} from '../__mocks__/worklogTypes';
import {mockCrashlytics} from '../__mocks__';
import StaffService from '../lib/StaffApiServices';
import TimeTracker from '../lib/db/TimeTrackerService';

describe('Shift', () => {
	beforeEach(() => {
		jest.clearAllMocks();
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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe(mockShiftId);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('API Error');
			StaffService.openShift.mockRejectedValueOnce(error);

			await expect(Shift.open()).rejects.toThrow('API Error');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(mockCrashlytics.recordError).toHaveBeenCalledWith(
				error,
				'Error opening shift in staff service'
			);
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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(result).toBe(mockShiftId);
		});

		it('should handle response without result', async () => {
			StaffService.openShift.mockResolvedValueOnce({});
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [],
			});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift');
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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift');
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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift');
			expect(TimeTracker.addEvent).toHaveBeenCalled();
			expect(result).toBe('');
		});

		it('should handle staff service errors', async () => {
			const error = new Error('Close shift failed');
			StaffService.closeShift.mockRejectedValueOnce(error);

			await expect(Shift.finish()).rejects.toThrow('Close shift failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift');
			expect(mockCrashlytics.recordError).toHaveBeenCalledWith(
				error,
				'Error closing shift in staff service'
			);
		});

		it('should continue even if TimeTracker fails in finish', async () => {
			const mockShiftId = 'shift-777';
			StaffService.closeShift.mockResolvedValueOnce({
				result: {id: mockShiftId},
			});
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('Tracking failed'));

			const result = await Shift.finish();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift');
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

			const result = await Shift.fetchWorklogTypes();

			expect(StaffService.getWorkLogTypes).toHaveBeenCalled();
			expect(result).toEqual(parsedWorklogTypes);
		});

		it('should handle empty worklog types response', async () => {
			StaffService.getWorkLogTypes.mockResolvedValueOnce({
				result: undefined,
			});

			const result = await Shift.fetchWorklogTypes();

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

			StaffService.getWorkLogTypes.mockResolvedValueOnce({
				result: mockWorklogTypes,
			});

			const result = await Shift.fetchWorklogTypes();

			expect(result).toEqual([
				...parsedWorklogTypes,
				{
					id: 'type-4',
					referenceId: 'ref-4',
					worklogName: 'Trabajo Mínimo',
					type: '',
					description: '',
					suggestedTime: 0,
				},
			]);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('API Error');
			StaffService.getWorkLogTypes.mockRejectedValueOnce(error);

			await expect(Shift.fetchWorklogTypes()).rejects.toThrow('API Error');
		});
	});

	describe('fetchWorklogTypes', () => {
		it('should fetch worklog types successfully', async () => {
			StaffService.getWorkLogTypes.mockResolvedValueOnce({
				result: worklogTypes,
			});

			const result = await Shift.fetchWorklogTypes();

			expect(StaffService.getWorkLogTypes).toHaveBeenCalled();

			expect(result).toEqual(parsedWorklogTypes);
		});

		it('should handle empty worklog types response', async () => {
			StaffService.getWorkLogTypes.mockResolvedValueOnce({
				result: undefined,
			});

			const result = await Shift.fetchWorklogTypes();

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

			StaffService.getWorkLogTypes.mockResolvedValueOnce({
				result: mockWorklogTypes,
			});

			const result = await Shift.fetchWorklogTypes();

			expect(result).toEqual([
				...parsedWorklogTypes,
				{
					id: 'type-4',
					referenceId: 'ref-4',
					worklogName: 'Trabajo Mínimo',
					type: '',
					description: '',
					suggestedTime: 0,
				},
			]);
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

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user delete shift registers');
			expect(TimeTracker.deleteAllEvents).toHaveBeenCalled();
			expect(result).toBe(true);
		});

		it('should handle TimeTracker errors', async () => {
			const error = new Error('Delete failed');
			TimeTracker.deleteAllEvents.mockRejectedValueOnce(error);

			await expect(Shift.deleteShiftRegisters()).rejects.toThrow('Delete failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user delete shift registers');
			expect(mockCrashlytics.recordError).toHaveBeenCalledWith(
				error,
				'Error deleting registers from shift tracking database'
			);
		});
	});
});
