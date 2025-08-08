import React from 'react';
import {render, waitFor} from '@testing-library/react';
import ShiftTrackingProvider from '../lib/provider/ShiftTrackingProvider';
import Shift from '../lib/Shift';
import Crashlytics from '../lib/utils/crashlytics';
import getUserId from '../lib/utils/userInfo/getUserId';

jest.mock('../lib/utils/userInfo/getUserId', () => jest.fn());

jest.mock('../lib/utils/crashlytics', () => ({
	log: jest.fn(),
	recordError: jest.fn(),
}));

jest.mock('../lib/context/ShiftTrackingContext', () => ({
	__esModule: true,
	default: {
		Provider: ({children}) => <div data-testid="context-provider">{children}</div>,
	},
}));

describe('ShiftTrackingProvider', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should open shift when no userId is available and log the action', async () => {
		getUserId.mockResolvedValueOnce(null);

		const spyOpen = jest.spyOn(Shift, 'open').mockResolvedValueOnce('shift-123');

		render(
			<ShiftTrackingProvider>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getUserId).toHaveBeenCalled();
			expect(spyOpen).toHaveBeenCalled();
			expect(Crashlytics.log).toHaveBeenCalledWith('open shift by provider');
		});
	});

	it('should open shift when user has no open shift', async () => {
		getUserId.mockResolvedValueOnce('user-123');

		const spyGetUserOpenShift = jest.spyOn(Shift, 'getUserOpenShift').mockResolvedValueOnce({});
		const spyOpen = jest.spyOn(Shift, 'open').mockResolvedValueOnce('shift-123');

		render(
			<ShiftTrackingProvider>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getUserId).toHaveBeenCalled();
			expect(spyGetUserOpenShift).toHaveBeenCalledWith({userId: 'user-123'});
			expect(spyOpen).toHaveBeenCalled();
		});
	});

	it('should not open shift when user already has an open shift', async () => {
		getUserId.mockResolvedValueOnce('user-123');

		const mockCurrentShift = {id: 'shift-123', status: 'opened'};
		const spyGetUserOpenShift = jest
			.spyOn(Shift, 'getUserOpenShift')
			.mockResolvedValueOnce(mockCurrentShift);
		const spyOpen = jest.spyOn(Shift, 'open').mockResolvedValueOnce('shift-123');

		render(
			<ShiftTrackingProvider>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(getUserId).toHaveBeenCalled();
			expect(spyGetUserOpenShift).toHaveBeenCalledWith({userId: 'user-123'});
			expect(spyOpen).not.toHaveBeenCalled();
		});
	});

	it('should handle errors when opening shift - with callback provided', async () => {
		getUserId.mockResolvedValueOnce('user-123');

		const mockError = new Error('Error opening shift');
		jest.spyOn(Shift, 'getUserOpenShift').mockRejectedValueOnce(mockError);
		const onOpenShiftError = jest.fn().mockReturnValueOnce('error-handled');

		render(
			<ShiftTrackingProvider onOpenShiftError={onOpenShiftError}>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(Crashlytics.recordError).toHaveBeenCalledWith(
				mockError,
				'Error opening shift in staff service'
			);
			expect(onOpenShiftError).toHaveBeenCalledWith(mockError);
		});
	});

	it('should handle errors when opening shift - without callback provided', async () => {
		getUserId.mockResolvedValueOnce('user-123');

		const mockError = new Error('Error opening shift');
		jest.spyOn(Shift, 'getUserOpenShift').mockRejectedValueOnce(mockError);

		render(
			<ShiftTrackingProvider>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(Crashlytics.recordError).toHaveBeenCalledWith(
				mockError,
				'Error opening shift in staff service'
			);
		});
	});

	it('should log to crashlytics when shift opens successfully', async () => {
		getUserId.mockResolvedValueOnce('user-123');

		jest.spyOn(Shift, 'getUserOpenShift').mockResolvedValueOnce({});
		const spyOpen = jest.spyOn(Shift, 'open').mockResolvedValueOnce('shift-123');

		render(
			<ShiftTrackingProvider>
				<div>Test Child</div>
			</ShiftTrackingProvider>
		);

		await waitFor(() => {
			expect(spyOpen).toHaveBeenCalledTimes(1);
			expect(Crashlytics.log).toHaveBeenCalledWith('open shift by provider');
			expect(Crashlytics.recordError).not.toHaveBeenCalled();
		});
	});
});
