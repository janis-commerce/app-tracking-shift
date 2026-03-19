import {isFunction} from '@janiscommerce/apps-helpers';
import Storage from './db/StorageService';
import {LAST_TIMER_RESET_AT} from './constant';

class ShiftInactivity {
	constructor() {
		this.timerId = null;
		this.timerDuration = 0;
		this.isActive = false;
		this.onTimeOut = () => {};
		this.ownerId = null;
	}

	get lastTimerResetAt() {
		return Storage.get(LAST_TIMER_RESET_AT) || null;
	}

	configureTimer(timeoutMs) {
		this.timerDuration = timeoutMs;
	}

	startTimer({duration, onTimeout, ownerId} = {}) {
		this.ownerId = ownerId || null;
		this.onTimeOut = onTimeout || this.onTimeOut;
		this.clearTimer();
		Storage.set(LAST_TIMER_RESET_AT, Date.now());
		this.isActive = true;
		this.timerId = setTimeout(() => {
			if (isFunction(this.onTimeOut)) this.onTimeOut();
		}, duration || this.timerDuration);
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

	stopTimer(ownerId) {
		if (ownerId && this.ownerId && ownerId !== this.ownerId) return;
		this.clearTimer();
		this.isActive = false;
		this.ownerId = null;
		Storage.remove(LAST_TIMER_RESET_AT);
	}
}

export default new ShiftInactivity();
