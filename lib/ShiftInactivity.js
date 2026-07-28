import {isFunction} from '@janiscommerce/apps-helpers';
import Storage from './db/StorageService';
import {TIMER_EXPIRES_AT} from './constant';

class ShiftInactivity {
	constructor() {
		this.timerId = null;
		this.timerDuration = 0;
		this.isActive = false;
		this.onTimeOut = () => {};
		this.instanceId = null;
	}

	get timerExpiresAt() {
		return Storage.get(TIMER_EXPIRES_AT);
	}

	configureTimer(timeoutMs) {
		this.timerDuration = timeoutMs;
	}

	startTimer({duration, onTimeout, instanceId} = {}) {
		this.instanceId = instanceId ?? this.instanceId;
		this.onTimeOut = onTimeout || this.onTimeOut;
		this.clearTimer();

		const timerDuration = duration ?? this.timerDuration;
		const expiresAt = Date.now() + timerDuration;

		Storage.set(TIMER_EXPIRES_AT, expiresAt, {expireWithVersion: true});

		this.isActive = true;
		this.timerId = setTimeout(() => {
			if (isFunction(this.onTimeOut)) this.onTimeOut();
		}, timerDuration);
	}

	resetTimer() {
		if (!this.isActive) return;
		this.startTimer({duration: this.timerDuration});
	}

	clearTimer() {
		if (!this.timerId) return;
		clearTimeout(this.timerId);
		this.timerId = null;
	}

	stopTimer(instanceId) {
		if (instanceId && this.instanceId && instanceId !== this.instanceId) return;
		this.reset();
	}

	/**
	 * Reset the inactivity timer and its persisted expiry unconditionally. Used when
	 * the shift identity changes so a stale expiry from a previous shift is not reused.
	 */

	reset() {
		this.clearTimer();
		this.isActive = false;
		this.instanceId = null;
		Storage.remove(TIMER_EXPIRES_AT);
	}
}

export default new ShiftInactivity();
