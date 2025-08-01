import Shift from '../lib/Shift';
import { mockRequest, mockTimeTracker, mockCrashlytics } from '../__mocks__';

describe('Shift', () => {
	let shift;
	
	beforeEach(() => {
		jest.clearAllMocks();
		shift = new Shift({ environment: 'test' });
	});

	describe('open', () => {
		it('should start a shift successfully', async () => {
			const mockShiftId = 'shift-123';
			mockRequest.post.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			mockTimeTracker.addEvent.mockResolvedValueOnce();

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
			
			mockRequest.post.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			mockTimeTracker.addEvent.mockResolvedValueOnce();

			const result = await shift.open({ date: specificDate });

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
			mockRequest.post.mockRejectedValueOnce(error);

			await expect(shift.open()).rejects.toThrow('API Error');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(mockCrashlytics.recordError).toHaveBeenCalledWith(error, 'Error opening shift in staff service');
		});

		it('should continue even if TimeTracker fails', async () => {
			const mockShiftId = 'shift-789';
			mockRequest.post.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			mockTimeTracker.addEvent.mockRejectedValueOnce(new Error('Tracking failed'));

			const result = await shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(result).toBe(mockShiftId);
		});

		it('should handle response without result', async () => {
			mockRequest.post.mockResolvedValueOnce({});
			mockTimeTracker.addEvent.mockResolvedValueOnce();

			const result = await shift.open();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user open shift');
			expect(mockTimeTracker.addEvent).toHaveBeenCalledWith({
				id: '',
				time: expect.any(String),
				type: 'start'
			});
			expect(result).toBe('');
		});

		it('should handle response with result but without id', async () => {
			mockRequest.post.mockResolvedValueOnce({ result: {} });
			mockTimeTracker.addEvent.mockResolvedValueOnce();

			const result = await shift.open();

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
			mockRequest.post.mockResolvedValueOnce({
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
			
			mockRequest.post.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			mockTimeTracker.addEvent.mockResolvedValueOnce();

			const result = await shift.finish({ date: specificDate });

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
			
			mockRequest.post.mockResolvedValueOnce({
				result:undefined
			});
			mockTimeTracker.addEvent.mockRejectedValueOnce(new Error('id is invalid or null'));

			const result = await shift.finish({ date: specificDate });

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
			mockRequest.post.mockRejectedValueOnce(error);

			await expect(shift.finish()).rejects.toThrow('Close shift failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user close shift');
			expect(mockCrashlytics.recordError).toHaveBeenCalledWith(error, 'Error closing shift in staff service');
		});
	});

	describe('deleteShiftRegisters', () => {
		it('should delete all registers successfully', async () => {
			mockTimeTracker.deleteAllEvents.mockResolvedValueOnce();

			const result = await shift.deleteShiftRegisters();

			expect(mockCrashlytics.log).toHaveBeenCalledWith('user delete shift registers');
			expect(mockTimeTracker.deleteAllEvents).toHaveBeenCalled();
		});

		it('should handle TimeTracker errors', async () => {
			const error = new Error('Delete failed');
			mockTimeTracker.deleteAllEvents.mockRejectedValueOnce(error);

			await expect(shift.deleteShiftRegisters()).rejects.toThrow('Delete failed');
			expect(mockCrashlytics.log).toHaveBeenCalledWith('user delete shift registers');
			expect(mockCrashlytics.recordError).toHaveBeenCalledWith(error, 'Error deleting registers from shift tracking database');
		});
	});
}); 