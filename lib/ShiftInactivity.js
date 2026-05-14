import {isFunction} from '@janiscommerce/apps-helpers';
import Storage from './db/StorageService';
import {LAST_TIMER_RESET_AT} from './constant';

class ShiftInactivity {
	constructor() {
		this.timerId = null;
		this.timerDuration = 0;
		this.isActive = false;
		this.onTimeOut = () => {};
		this.instanceId = null;
	}

	get lastTimerResetAt() {
		return Storage.get(LAST_TIMER_RESET_AT);
	}

	configureTimer(timeoutMs) {
		this.timerDuration = timeoutMs;
	}

	startTimer({duration, onTimeout, instanceId} = {}) {
		this.instanceId = instanceId ?? this.instanceId;
		this.onTimeOut = onTimeout || this.onTimeOut;
		this.clearTimer();
		Storage.set(LAST_TIMER_RESET_AT, Date.now());
		this.isActive = true;
		this.timerId = setTimeout(() => {
			if (isFunction(this.onTimeOut)) this.onTimeOut();
		}, duration ?? this.timerDuration);
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
		this.clearTimer();
		this.isActive = false;
		this.instanceId = null;
		Storage.remove(LAST_TIMER_RESET_AT);
	}
}

export default new ShiftInactivity();
