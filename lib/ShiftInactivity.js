import Storage from './db/StorageService';
import {LAST_TIMER_RESET_AT} from './constant';

class ShiftInactivity {
	constructor() {
		this._timerId = null;
		this._timeoutMs = 0;
		this._isActive = false;
		this._onTimeout = () => {};
		this._ownerId = null;
	}

	get lastTimerResetAt() {
		return Storage.get(LAST_TIMER_RESET_AT) || null;
	}

	configureTimer(timeoutMs) {
		this._timeoutMs = timeoutMs;
	}

	startTimer({duration, onTimeout, ownerId} = {}) {
		this._ownerId = ownerId || null;
		this._onTimeout = onTimeout || this._onTimeout;
		this.clearTimer();
		Storage.set(LAST_TIMER_RESET_AT, Date.now());
		this._isActive = true;
		this._timerId = setTimeout(() => {
			if (this._onTimeout) this._onTimeout();
		}, duration || this._timeoutMs);
	}

	resetTimer() {
		if (!this._isActive) return;
		this.startTimer({duration: this._timeoutMs});
	}

	clearTimer() {
		if (!this._timerId) return;
		clearTimeout(this._timerId);
		this._timerId = null;
	}

	stopTimer(ownerId) {
		if (ownerId && this._ownerId && ownerId !== this._ownerId) return;
		this.clearTimer();
		this._isActive = false;
		this._ownerId = null;
		Storage.remove(LAST_TIMER_RESET_AT);
	}
}

export default new ShiftInactivity();
