import ShiftInactivity from '../lib/ShiftInactivity';
import Storage from '../lib/db/StorageService';
import {LAST_TIMER_RESET_AT} from '../lib/constant';

jest.useFakeTimers();

describe('ShiftInactivity', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();

		// Reset instance internal state
		ShiftInactivity.timerId = null;
		ShiftInactivity.timerDuration = 0;
		ShiftInactivity.isActive = false;
		ShiftInactivity.onTimeOut = () => {};
		ShiftInactivity.ownerId = null;

		// Reset Storage mocks
		Storage.get.mockReturnValue(null);
		Storage.set.mockClear();
		Storage.remove.mockClear();
	});

	afterEach(() => {
		jest.clearAllTimers();
	});

	describe('lastTimerResetAt', () => {
		it('must return the value stored in Storage when it exists', () => {
			const mockTimestamp = 1234567890;
			Storage.get.mockReturnValue(mockTimestamp);

			const result = ShiftInactivity.lastTimerResetAt;

			expect(result).toBe(mockTimestamp);
			expect(Storage.get).toHaveBeenCalledWith(LAST_TIMER_RESET_AT);
		});

		it('should return null when there is no stored value', () => {
			Storage.get.mockReturnValue(null);

			const result = ShiftInactivity.lastTimerResetAt;

			expect(result).toBeNull();
			expect(Storage.get).toHaveBeenCalledWith(LAST_TIMER_RESET_AT);
		});

		it('should return null when Storage.get returns undefined', () => {
			Storage.get.mockReturnValue(undefined);

			const result = ShiftInactivity.lastTimerResetAt;

			expect(result).toBeNull();
		});
	});

	describe('configureTimer', () => {
		it('should configure the timeout in milliseconds', () => {
			const timeoutMs = 5000;

			ShiftInactivity.configureTimer(timeoutMs);

			expect(ShiftInactivity.timerDuration).toBe(timeoutMs);
		});

		it('should accept timeout values of 0', () => {
			ShiftInactivity.configureTimer(0);

			expect(ShiftInactivity.timerDuration).toBe(0);
		});

		it('should overwrite previous configurations', () => {
			ShiftInactivity.configureTimer(1000);
			expect(ShiftInactivity.timerDuration).toBe(1000);

			ShiftInactivity.configureTimer(3000);
			expect(ShiftInactivity.timerDuration).toBe(3000);
		});
	});

	describe('startTimer', () => {
		it('should start the timer with specified duration and execute callback when it finishes', () => {
			const duration = 5000;
			const onTimeout = jest.fn();
			const ownerId = 'owner-123';

			ShiftInactivity.startTimer({duration, onTimeout, ownerId});

			expect(ShiftInactivity.isActive).toBe(true);
			expect(ShiftInactivity.ownerId).toBe(ownerId);
			expect(ShiftInactivity.onTimeOut).toBe(onTimeout);
			expect(Storage.set).toHaveBeenCalledWith(LAST_TIMER_RESET_AT, expect.any(Number));
			expect(ShiftInactivity.timerId).not.toBeNull();

			jest.advanceTimersByTime(duration);

			expect(onTimeout).toHaveBeenCalledTimes(1);
		});

		it('should use the configured timerDuration when duration is not provided', () => {
			const configuredTimeout = 3000;
			const onTimeout = jest.fn();

			ShiftInactivity.configureTimer(configuredTimeout);
			ShiftInactivity.startTimer({onTimeout});

			expect(ShiftInactivity.timerId).not.toBeNull();

			jest.advanceTimersByTime(configuredTimeout);

			expect(onTimeout).toHaveBeenCalledTimes(1);
		});

		it('should use default values when no parameters are provided', () => {
			ShiftInactivity.timerDuration = 2000;
			ShiftInactivity.onTimeOut = jest.fn();

			ShiftInactivity.startTimer();

			expect(ShiftInactivity.isActive).toBe(true);
			expect(ShiftInactivity.ownerId).toBeNull();
			expect(ShiftInactivity.timerId).not.toBeNull();

			jest.advanceTimersByTime(2000);

			expect(ShiftInactivity.onTimeOut).toHaveBeenCalledTimes(1);
		});

		it('should set ownerId to null when no ownerId is provided', () => {
			const onTimeout = jest.fn();

			ShiftInactivity.startTimer({duration: 1000, onTimeout});

			expect(ShiftInactivity.ownerId).toBeNull();
		});

		it('should keep the previous onTimeout if no new one is provided', () => {
			const firstCallback = jest.fn();
			const secondCallback = jest.fn();

			ShiftInactivity.startTimer({duration: 1000, onTimeout: firstCallback});
			expect(ShiftInactivity.onTimeOut).toBe(firstCallback);

			ShiftInactivity.startTimer({duration: 1000});
			expect(ShiftInactivity.onTimeOut).toBe(firstCallback);

			ShiftInactivity.startTimer({duration: 1000, onTimeout: secondCallback});
			expect(ShiftInactivity.onTimeOut).toBe(secondCallback);
		});

		it('should clear the previous timer before starting a new one', () => {
			const firstCallback = jest.fn();
			const secondCallback = jest.fn();

			ShiftInactivity.startTimer({duration: 5000, onTimeout: firstCallback});

			jest.advanceTimersByTime(2000);

			ShiftInactivity.startTimer({duration: 3000, onTimeout: secondCallback});

			jest.advanceTimersByTime(3000);

			expect(firstCallback).not.toHaveBeenCalled();
			expect(secondCallback).toHaveBeenCalledTimes(1);
		});

		it('should save the current timestamp in Storage', () => {
			const mockNow = 1234567890;
			jest.spyOn(Date, 'now').mockReturnValue(mockNow);

			ShiftInactivity.startTimer({duration: 1000});

			expect(Storage.set).toHaveBeenCalledWith(LAST_TIMER_RESET_AT, mockNow);

			Date.now.mockRestore();
		});

		it('should not execute callback if onTimeout is null or undefined', () => {
			ShiftInactivity.startTimer({duration: 1000, onTimeout: null});

			jest.advanceTimersByTime(1000);

			// Should not throw error
			expect(() => jest.runAllTimers()).not.toThrow();
		});

		it('should keep the previous onTimeout when onTimeout is not provided', () => {
			const previousCallback = jest.fn();

			ShiftInactivity.onTimeOut = previousCallback;
			ShiftInactivity.startTimer({duration: 1000});

			expect(ShiftInactivity.onTimeOut).toBe(previousCallback);

			jest.advanceTimersByTime(1000);

			expect(previousCallback).toHaveBeenCalledTimes(1);
		});

		it('should not execute callback when onTimeout is not a function (string)', () => {
			ShiftInactivity.startTimer({duration: 1000, onTimeout: 'not a function'});

			expect(ShiftInactivity.onTimeOut).toBe('not a function');

			jest.advanceTimersByTime(1000);

			// Should not throw error, isFunction prevents execution
			expect(() => jest.runAllTimers()).not.toThrow();
		});

		it('should not execute callback when onTimeout is not a function (number)', () => {
			ShiftInactivity.startTimer({duration: 1000, onTimeout: 12345});

			expect(ShiftInactivity.onTimeOut).toBe(12345);

			jest.advanceTimersByTime(1000);

			// Should not throw error, isFunction prevents execution
			expect(() => jest.runAllTimers()).not.toThrow();
		});

		it('should not execute callback when onTimeout is not a function (object)', () => {
			const notAFunction = {key: 'value'};
			ShiftInactivity.startTimer({duration: 1000, onTimeout: notAFunction});

			expect(ShiftInactivity.onTimeOut).toBe(notAFunction);

			jest.advanceTimersByTime(1000);

			// Should not throw error, isFunction prevents execution
			expect(() => jest.runAllTimers()).not.toThrow();
		});

		it('should not execute callback when onTimeout is not a function (array)', () => {
			const notAFunction = [1, 2, 3];
			ShiftInactivity.startTimer({duration: 1000, onTimeout: notAFunction});

			expect(ShiftInactivity.onTimeOut).toEqual(notAFunction);

			jest.advanceTimersByTime(1000);

			// Should not throw error, isFunction prevents execution
			expect(() => jest.runAllTimers()).not.toThrow();
		});

		it('should execute callback when onTimeout is a valid function after having a non-function value', () => {
			// First set a non-function value
			ShiftInactivity.startTimer({duration: 1000, onTimeout: 'not a function'});

			jest.advanceTimersByTime(1000);

			// Now set a valid function
			const validCallback = jest.fn();
			ShiftInactivity.startTimer({duration: 1000, onTimeout: validCallback});

			expect(ShiftInactivity.onTimeOut).toBe(validCallback);

			jest.advanceTimersByTime(1000);

			expect(validCallback).toHaveBeenCalledTimes(1);
		});

		it('should use the default onTimeout from constructor when none is provided', () => {
			// Reset to the default constructor function
			ShiftInactivity.onTimeOut = () => {};

			ShiftInactivity.startTimer({duration: 1000});

			expect(ShiftInactivity.onTimeOut).toEqual(expect.any(Function));

			jest.advanceTimersByTime(1000);

			// Should not throw error
			expect(() => jest.runAllTimers()).not.toThrow();
		});
	});

	describe('resetTimer', () => {
		it('should restart the timer with the configured duration when it is active', () => {
			const timeoutMs = 5000;
			const onTimeout = jest.fn();

			ShiftInactivity.configureTimer(timeoutMs);
			ShiftInactivity.startTimer({duration: timeoutMs, onTimeout});

			jest.advanceTimersByTime(2000);

			ShiftInactivity.resetTimer();

			jest.advanceTimersByTime(2000);
			expect(onTimeout).not.toHaveBeenCalled();

			jest.advanceTimersByTime(3000);
			expect(onTimeout).toHaveBeenCalledTimes(1);
		});

		it('should do nothing if the timer is not active', () => {
			const initialSetCount = Storage.set.mock.calls.length;

			ShiftInactivity.configureTimer(5000);
			ShiftInactivity.isActive = false;

			ShiftInactivity.resetTimer();

			expect(Storage.set.mock.calls.length).toBe(initialSetCount);
			expect(ShiftInactivity.timerId).toBeNull();
		});

		it('should reset the ownerId to null when restarting', () => {
			const ownerId = 'owner-456';
			const timeoutMs = 3000;
			const onTimeout = jest.fn();

			ShiftInactivity.configureTimer(timeoutMs);
			ShiftInactivity.startTimer({duration: timeoutMs, ownerId, onTimeout});

			expect(ShiftInactivity.ownerId).toBe(ownerId);

			ShiftInactivity.resetTimer();

			// resetTimer calls startTimer without ownerId, so it resets to null
			expect(ShiftInactivity.ownerId).toBeNull();
		});

		it('should update the timestamp in Storage when restarting', () => {
			const timeoutMs = 3000;
			const firstTimestamp = 1000000;
			const secondTimestamp = 2000000;

			jest
				.spyOn(Date, 'now')
				.mockReturnValueOnce(firstTimestamp)
				.mockReturnValueOnce(secondTimestamp);

			ShiftInactivity.configureTimer(timeoutMs);
			ShiftInactivity.startTimer({duration: timeoutMs});

			expect(Storage.set).toHaveBeenCalledWith(LAST_TIMER_RESET_AT, firstTimestamp);

			ShiftInactivity.resetTimer();

			expect(Storage.set).toHaveBeenCalledWith(LAST_TIMER_RESET_AT, secondTimestamp);

			Date.now.mockRestore();
		});
	});

	describe('clearTimer', () => {
		it('should clear the active timer', () => {
			const onTimeout = jest.fn();

			ShiftInactivity.startTimer({duration: 5000, onTimeout});

			expect(ShiftInactivity.timerId).not.toBeNull();

			ShiftInactivity.clearTimer();

			expect(ShiftInactivity.timerId).toBeNull();
		});

		it('should do nothing if there is no active timer', () => {
			ShiftInactivity.timerId = null;

			const result = ShiftInactivity.clearTimer();

			expect(ShiftInactivity.timerId).toBeNull();
			expect(result).toBeUndefined();
		});

		it('should prevent the callback from being executed after clearing', () => {
			const onTimeout = jest.fn();

			ShiftInactivity.startTimer({duration: 5000, onTimeout});
			ShiftInactivity.clearTimer();

			jest.advanceTimersByTime(5000);

			expect(onTimeout).not.toHaveBeenCalled();
		});
	});

	describe('stopTimer', () => {
		it('should stop the timer and reset the state when there is no ownerId', () => {
			const onTimeout = jest.fn();

			ShiftInactivity.startTimer({duration: 5000, onTimeout});
			ShiftInactivity.stopTimer();

			expect(ShiftInactivity.isActive).toBe(false);
			expect(ShiftInactivity.ownerId).toBeNull();
			expect(ShiftInactivity.timerId).toBeNull();
			expect(Storage.remove).toHaveBeenCalledWith(LAST_TIMER_RESET_AT);

			jest.advanceTimersByTime(5000);
			expect(onTimeout).not.toHaveBeenCalled();
		});

		it('should stop the timer when the ownerId matches', () => {
			const ownerId = 'owner-789';
			const onTimeout = jest.fn();

			ShiftInactivity.startTimer({duration: 5000, onTimeout, ownerId});
			ShiftInactivity.stopTimer(ownerId);

			expect(ShiftInactivity.isActive).toBe(false);
			expect(ShiftInactivity.ownerId).toBeNull();
			expect(Storage.remove).toHaveBeenCalledWith(LAST_TIMER_RESET_AT);
		});

		it('should not stop the timer when the ownerId does not match', () => {
			const ownerId = 'owner-abc';
			const differentOwnerId = 'owner-xyz';
			const onTimeout = jest.fn();

			ShiftInactivity.startTimer({duration: 5000, onTimeout, ownerId});

			// Clear previous Storage.remove calls from beforeEach
			Storage.remove.mockClear();

			ShiftInactivity.stopTimer(differentOwnerId);

			expect(ShiftInactivity.isActive).toBe(true);
			expect(ShiftInactivity.ownerId).toBe(ownerId);
			expect(ShiftInactivity.timerId).not.toBeNull();
			expect(Storage.remove).not.toHaveBeenCalled();

			jest.advanceTimersByTime(5000);
			expect(onTimeout).toHaveBeenCalledTimes(1);
		});

		it('should stop the timer when ownerId is provided but there is no ownerId internally', () => {
			const onTimeout = jest.fn();

			ShiftInactivity.startTimer({duration: 5000, onTimeout});
			ShiftInactivity.stopTimer('any-owner-id');

			expect(ShiftInactivity.isActive).toBe(false);
			expect(Storage.remove).toHaveBeenCalledWith(LAST_TIMER_RESET_AT);
		});

		it('should stop the timer when no ownerId is provided but there is an internal ownerId', () => {
			const ownerId = 'owner-def';
			const onTimeout = jest.fn();

			ShiftInactivity.startTimer({duration: 5000, onTimeout, ownerId});
			ShiftInactivity.stopTimer();

			expect(ShiftInactivity.isActive).toBe(false);
			expect(ShiftInactivity.ownerId).toBeNull();
			expect(Storage.remove).toHaveBeenCalledWith(LAST_TIMER_RESET_AT);
		});

		it('should handle the case when timerId is null', () => {
			ShiftInactivity.timerId = null;
			ShiftInactivity.isActive = true;

			ShiftInactivity.stopTimer();

			expect(ShiftInactivity.isActive).toBe(false);
			expect(Storage.remove).toHaveBeenCalledWith(LAST_TIMER_RESET_AT);
		});
	});

	describe('Integration - Complete cycle', () => {
		it('should handle a complete cycle of configuration, start, reset and stop', () => {
			const timeoutMs = 10000;
			const onTimeout = jest.fn();
			const ownerId = 'integration-owner';

			ShiftInactivity.configureTimer(timeoutMs);
			ShiftInactivity.startTimer({duration: timeoutMs, onTimeout, ownerId});

			expect(ShiftInactivity.isActive).toBe(true);

			jest.advanceTimersByTime(5000);
			ShiftInactivity.resetTimer();

			jest.advanceTimersByTime(5000);
			expect(onTimeout).not.toHaveBeenCalled();

			jest.advanceTimersByTime(5000);
			expect(onTimeout).toHaveBeenCalledTimes(1);

			ShiftInactivity.stopTimer(ownerId);

			expect(ShiftInactivity.isActive).toBe(false);
			expect(Storage.remove).toHaveBeenCalledWith(LAST_TIMER_RESET_AT);
		});

		it('should allow multiple resets before it expires', () => {
			const timeoutMs = 5000;
			const onTimeout = jest.fn();

			ShiftInactivity.configureTimer(timeoutMs);
			ShiftInactivity.startTimer({duration: timeoutMs, onTimeout});

			jest.advanceTimersByTime(3000);
			ShiftInactivity.resetTimer();

			jest.advanceTimersByTime(3000);
			ShiftInactivity.resetTimer();

			jest.advanceTimersByTime(3000);
			ShiftInactivity.resetTimer();

			jest.advanceTimersByTime(4999);
			expect(onTimeout).not.toHaveBeenCalled();

			jest.advanceTimersByTime(1);
			expect(onTimeout).toHaveBeenCalledTimes(1);
		});
	});
});
