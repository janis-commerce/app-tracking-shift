import Shift from '../src/classes/Shift';
import { mockRequest, mockTimeTracker } from '../__mocks__';
import { worklogTypes, parsedWorklogTypes } from '../__mocks__/worklogTypes';

describe('Shift', () => {
	let shift;
	
	beforeEach(() => {
		jest.clearAllMocks();
		shift = new Shift({ environment: 'test' });
	});

	describe('initShift', () => {
		it('should start a shift successfully', async () => {
			// Setup mocks
			const mockShiftId = 'shift-123';
			mockRequest.post.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			mockTimeTracker.addEvent.mockResolvedValueOnce();

			// Execute method
			const result = await shift.initShift();

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

			const result = await shift.initShift({ date: specificDate });

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

			await expect(shift.initShift()).rejects.toThrow('API Error');
		});

		it('should continue even if TimeTracker fails', async () => {
			const mockShiftId = 'shift-789';
			mockRequest.post.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			mockTimeTracker.addEvent.mockRejectedValueOnce(new Error('Tracking failed'));

			const result = await shift.initShift();

			expect(result).toBe(mockShiftId);
		});

		it('should handle response without result', async () => {
			mockRequest.post.mockResolvedValueOnce({});
			mockTimeTracker.addEvent.mockResolvedValueOnce();

			const result = await shift.initShift();

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

			const result = await shift.initShift();

			expect(mockTimeTracker.addEvent).toHaveBeenCalledWith({
				id: '',
				time: expect.any(String),
				type: 'start'
			});
			expect(result).toBe('');
		});
	});

	describe('finishShift', () => {
		it('should finish a shift successfully', async () => {
			const mockShiftId = 'shift-999';
			mockRequest.post.mockResolvedValueOnce({
				result: { id: mockShiftId }
			});
			mockTimeTracker.addEvent.mockResolvedValueOnce();

			const result = await shift.finishShift();

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

			const result = await shift.finishShift({ date: specificDate });

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

			const result = await shift.finishShift({ date: specificDate });

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

			await expect(shift.finishShift()).rejects.toThrow('Close shift failed');
		});
	});

	describe('fetchWorklogTypes', () => {
		it('should fetch worklog types successfully', async () => {

			mockRequest.list.mockResolvedValueOnce({
				result: worklogTypes
			});

			const result = await shift.fetchWorklogTypes();

			expect(mockRequest.list).toHaveBeenCalledWith({
				service: 'staff',
				namespace: 'work-log-type',
				headers: {
					pageSize: 100,
				},
				queryParams: {
					filters: {
						status: "active",
						type: ["work", "pause", "problem"]
					}
				}
			});

			expect(result).toEqual(parsedWorklogTypes);
		});

		it('should handle empty worklog types response', async () => {
			mockRequest.list.mockResolvedValueOnce({
				result: undefined,
			});

			const result = await shift.fetchWorklogTypes();

			expect(result).toEqual([]);
		});

		it('should filter out worklog types without id or referenceId', async () => {
			const mockWorklogTypes = [
				...worklogTypes,
				{
					id: 'type-4',
					referenceId: 'ref-4',
					name: 'Trabajo Mínimo'
				}
			];

			mockRequest.list.mockResolvedValueOnce({
				result: mockWorklogTypes
			});

			const result = await shift.fetchWorklogTypes();

			expect(result).toEqual([
				...parsedWorklogTypes,
				{
					id: 'type-4',
					referenceId: 'ref-4',
					worklogName: 'Trabajo Mínimo',
					type: '',
					description: '',
					suggestedTime: 0
				}
			]);
		});

		it('should handle staff service errors', async () => {
			const error = new Error('API Error');
			mockRequest.list.mockRejectedValueOnce(error);

			await expect(shift.fetchWorklogTypes()).rejects.toThrow('API Error');
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