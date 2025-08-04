import Shift from '../lib/Shift';
import { mockRequest, mockTimeTracker, mockCrashlytics } from '../__mocks__';

describe('Shift', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const StaffService = require('../lib/StaffApiServices');
	const TimeTracker = require('../lib/db/TimeTrackerService');
	describe('open', () => {
		
		it('should start a shift successfully', async () => {
			const mockShiftId = 'shift-123';
			StaffService.openShift.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(mockRequest.post).toHaveBeenCalledWith({
				service: 'staff',
				namespace: 'shift-open'
			});
			expect(mockTimeTracker.addEvent).toHaveBeenCalledWith({
				id: mockShiftId,
				time: expect.any(String),
				type: 'start'
			});
			expect(result).toBe(mockShiftId);
		});

		it('should start a shift with specific date', async () => {
			const mockShiftId = 'shift-456';
			const specificDate = '2024-01-15T10:00:00.000Z';
			StaffService.openShift.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.open({ date: specificDate });

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(mockTimeTracker.addEvent).toHaveBeenCalledWith({
				id: mockShiftId,
				time: specificDate,
				type: 'start'
			});
			expect(result).toBe(mockShiftId);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('API Error');
			StaffService.openShift.mockRejectedValueOnce(error);

			await expect(shift.open()).rejects.toThrow('API Error');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(mockCrashlytics.recordError).toHaveBeenCalledWith(error, 'Error opening shift in staff service');
		});

		it('should continue even if TimeTracker fails', async () => {
			const mockShiftId = 'shift-789';
			StaffService.openShift.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('Tracking failed'));

			const result = await Shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(result).toBe(mockShiftId);
		});

		it('should handle response without result', async () => {
			StaffService.openShift.mockResolvedValueOnce({});
			
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(mockTimeTracker.addEvent).toHaveBeenCalledWith({
				id: '',
				time: expect.any(String),
				type: 'start'
			});
			expect(result).toBe('');
		});

		it('should handle response with result but without id', async () => {
			StaffService.openShift.mockResolvedValueOnce({ result: {} });
			
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(mockTimeTracker.addEvent).toHaveBeenCalledWith({
				id: '',
				time: expect.any(String),
				type: 'start'
			});
			expect(result).toBe('');
		});
	});

	describe('finish', () => {
		it('should finish a shift successfully', async () => {
			const mockShiftId = 'shift-999';
			StaffService.closeShift.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			mockTimeTracker.addEvent.mockResolvedValueOnce();

			const result = await shift.finish();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift');
			expect(mockRequest.post).toHaveBeenCalledWith({
				service: 'staff',
				namespace: 'shift-close'
			});
			expect(mockTimeTracker.addEvent).toHaveBeenCalledWith({
				id: mockShiftId,
				time: expect.any(String),
				type: 'finish'
			});
			expect(result).toBe(mockShiftId);
		});

		it('should finish a shift with specific date', async () => {
			const mockShiftId = 'shift-888';
			const specificDate = '2024-01-15T18:00:00.000Z';
			
			StaffService.closeShift.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finish({ date: specificDate });

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift');
			expect(mockTimeTracker.addEvent).toHaveBeenCalledWith({
				id: mockShiftId,
				time: specificDate,
				type: 'finish'
			});
			expect(result).toBe(mockShiftId);
		});

		it('should handle response with result but without id', async () => {
			const specificDate = '2024-01-15T18:00:00.000Z';
			
			StaffService.closeShift.mockResolvedValueOnce({
				result: undefined
			});
			
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('id is invalid or null'));

			const result = await Shift.finish({ date: specificDate });

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift');
			expect(mockTimeTracker.addEvent).toHaveBeenCalledWith({
				id: '',
				time: specificDate,
				type: 'finish'
			});
			expect(result).toBe('');
		})

		it('should handle staff service errors', async () => {
			const error = new Error('Close shift failed');
			StaffService.closeShift.mockRejectedValueOnce(error);

			await expect(Shift.finish()).rejects.toThrow('Close shift failed');
		});
	});

	describe('getUserOpenShift', () => {
		it('should get user open shift successfully', async () => {
			const mockShift = { id: 'shift-123', status: 'opened' };
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: [mockShift]
			});

			const result = await Shift.getUserOpenShift({ userId: 'user-123', id: 'shift-123' });

			expect(StaffService.getShiftsList).toHaveBeenCalledWith({
				filters: {
					userId: 'user-123',
					status: 'opened',
					id: 'shift-123'
				}
			});
			expect(result).toEqual(mockShift);
		});

		it('should return empty object when no open shift found', async () => {
			StaffService.getShiftsList.mockResolvedValueOnce({
				result: undefined
			});

			const result = await Shift.getUserOpenShift();

			expect(result).toEqual({});
		});

		it('should handle staff service errors', async () => {
			const error = new Error('Get shifts list failed');
			StaffService.getShiftsList.mockRejectedValueOnce(error);

			await expect(Shift.getUserOpenShift({ userId: 'user-123' })).rejects.toThrow('Get shifts list failed');
		});
	});

	describe('deleteShiftRegisters', () => {
		it('should delete all registers successfully', async () => {
			TimeTracker.deleteAllEvents.mockResolvedValueOnce();

			const result = await Shift.deleteShiftRegisters();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user delete shift registers');
			expect(TimeTracker.deleteAllEvents).toHaveBeenCalled();
		});

		it('should handle TimeTracker errors', async () => {
			const error = new Error('Delete failed');
			TimeTracker.deleteAllEvents.mockRejectedValueOnce(error);

			await expect(shift.deleteShiftRegisters()).rejects.toThrow('Delete failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user delete shift registers');
			expect(mockCrashlytics.recordError).toHaveBeenCalledWith(error, 'Error deleting registers from shift tracking database');
		});
	});
}); 