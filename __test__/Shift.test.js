import Shift from '../lib/Shift';
import { mockRequest, mockTimeTracker } from '../__mocks__';

describe('Shift', () => {
	let shift;
	
	beforeEach(() => {
		jest.clearAllMocks();
		shift = new Shift({ environment: 'test' });
	});

	describe('open', () => {
		it('should start a shift successfully', async () => {
			// Setup mocks
			const mockShiftId = 'shift-123';
			mockRequest.post.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			mockTimeTracker.addEvent.mockResolvedValueOnce();

			// Execute method
			const result = await shift.open();

			// Verify calls
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
		});

		it('should continue even if TimeTracker fails', async () => {
			const mockShiftId = 'shift-789';
			mockRequest.post.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			mockTimeTracker.addEvent.mockRejectedValueOnce(new Error('Tracking failed'));

			const result = await shift.open();

			expect(result).toBe(mockShiftId);
		});

		it('should handle response without result', async () => {
			mockRequest.post.mockResolvedValueOnce({});
			mockTimeTracker.addEvent.mockResolvedValueOnce();

			const result = await shift.open();

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
		});
	});

	describe('deleteShiftRegisters', () => {
		it('should delete all registers successfully', async () => {
			mockTimeTracker.deleteAllEvents.mockResolvedValueOnce();

			const result = await shift.deleteShiftRegisters();

			expect(mockTimeTracker.deleteAllEvents).toHaveBeenCalled();
			expect(result).toBe(true);
		});

		it('should handle TimeTracker errors', async () => {
			const error = new Error('Delete failed');
			mockTimeTracker.deleteAllEvents.mockRejectedValueOnce(error);

			await expect(shift.deleteShiftRegisters()).rejects.toThrow('Delete failed');
		});
	});
}); 