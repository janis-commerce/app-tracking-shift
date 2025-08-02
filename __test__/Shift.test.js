import Shift from '../lib/Shift';

describe('Shift', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const StaffService = require('../lib/StaffApiServices');
	const TimeTracker = require('../lib/db/TimeTrackerService');
	describe('open', () => {
		
		it('should start a shift successfully', async () => {
			// Setup mocks
			const mockShiftId = 'shift-123';
			StaffService.openShift.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			TimeTracker.addEvent.mockResolvedValueOnce();

			// Execute method
			const result = await Shift.open();

			// Verify calls
			expect(StaffService.openShift).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
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

			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
				id: mockShiftId,
				time: specificDate,
				type: 'start'
			});
			expect(result).toBe(mockShiftId);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('API Error');
			StaffService.openShift.mockRejectedValueOnce(error);

			await expect(Shift.open()).rejects.toThrow('API Error');
		});

		it('should continue even if TimeTracker fails', async () => {
			const mockShiftId = 'shift-789';
			StaffService.openShift.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			
			TimeTracker.addEvent.mockRejectedValueOnce(new Error('Tracking failed'));

			const result = await Shift.open();

			expect(result).toBe(mockShiftId);
		});

		it('should handle response without result', async () => {
			StaffService.openShift.mockResolvedValueOnce({});
			
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.open();

			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
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

			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
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
			
			TimeTracker.addEvent.mockResolvedValueOnce();

			const result = await Shift.finish();

			expect(StaffService.closeShift).toHaveBeenCalled();
			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
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

			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
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

			expect(TimeTracker.addEvent).toHaveBeenCalledWith({
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

			expect(TimeTracker.deleteAllEvents).toHaveBeenCalled();
			expect(result).toBe(true);
		});

		it('should handle TimeTracker errors', async () => {
			const error = new Error('Delete failed');
			TimeTracker.deleteAllEvents.mockRejectedValueOnce(error);

			await expect(Shift.deleteShiftRegisters()).rejects.toThrow('Delete failed');
		});
	});
}); 