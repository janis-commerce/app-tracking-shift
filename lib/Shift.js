import {isArray, isEmptyArray, isNumber} from '@janiscommerce/apps-helpers';
import StaffService from './StaffApiServices';
import Storage from './db/StorageService';
import ShiftWorklogs from './ShiftWorklogs';
import ShiftInactivity from './ShiftInactivity';
import {
	isApiError,
	isNetworkError,
	isInternetReachable,
	isValidDate,
	parseToISOString,
	Crashlytics,
	errorParser,
} from './helpers';
import {
	SHIFT_ID,
	SHIFT_STATUS,
	SHIFT_DATA,
	CURRENT_WORKLOG_DATA,
	CURRENT_WORKLOG_ID,
	EXCLUDED_WORKLOG_TYPES,
	DEFAULT_REOPENING_EXTENSION_TIME,
	WORKLOG_TYPES_DATA,
	STAFF_SETTINGS,
} from './constant';
import Formatter from './Formatter';
import OfflineData from './OfflineData';
/**
 * Class to manage work shifts
 * @class Shift
 */

class Shift {
	/**
	 * @returns {boolean} hasStaffAuthorization => true if the user has staff MS authorization, false otherwise
	 */

	get hasStaffAuthorization() {
		const {settings} = Storage.get(STAFF_SETTINGS) || {};
		const {enabledShiftAndWorkLog = false} = settings || {};
		return enabledShiftAndWorkLog;
	}

	/**
	 * @returns {boolean} hasInactivityDetectionEnabled => true if the client configured inactivity time and this is greater than 0
	 */

	get hasInactivityDetectionEnabled() {
		const {settings} = Storage.get(STAFF_SETTINGS) || {};
		const {inactivityTimeout = 0} = settings || {};
		return isNumber(inactivityTimeout) && inactivityTimeout > 0;
	}

	/**
	 * @returns {boolean} hasPendingData => true if the user has pending data, false otherwise
	 */

	get hasPendingData() {
		return OfflineData.hasData;
	}

	get id() {
		return Storage.get(SHIFT_ID);
	}

	set id(id) {
		Storage.set(SHIFT_ID, id);
	}

	get status() {
		return Storage.get(SHIFT_STATUS);
	}

	set status(status) {
		Storage.set(SHIFT_STATUS, status);
	}

	get hasWorkTypes() {
		const {workLogTypes = []} = Storage.get(WORKLOG_TYPES_DATA) || {};

		return !!workLogTypes?.length;
	}

	/**
	 * Get the shift data
	 * @returns {Object} data => The shift data
	 */

	get data() {
		return Storage.get(SHIFT_DATA);
	}

	/**
	 * Set the shift data
	 * @param {Object} data => The shift data to set
	 */

	set data(data) {
		Storage.set(SHIFT_DATA, data);
	}

	/**
	 * Get if there is a work log in progress
	 * @returns {boolean} true if there is a work log in progress, false otherwise
	 */

	get hasWorkLogInProgress() {
		return !!Storage.get(CURRENT_WORKLOG_ID);
	}

	get isOpen() {
		return this.status === 'opened';
	}

	/**
	 * Get if the shift is paused
	 * @returns {boolean} true if the shift is paused, false otherwise
	 */

	get isPaused() {
		return this.status === 'paused';
	}

	/**
	 * Check if the staff MS is enabled
	 * @returns {Promise<boolean>} true if the staff MS is enabled, false otherwise
	 */

	async checkStaffMSAuthorization() {
		const {enabledShiftAndWorkLog = false} = (await StaffService.getSettings()) || {};

		return enabledShiftAndWorkLog;
	}

	/**
	 * get global staff settings from the storage or fetch them from the staff API
	 * @returns {Promise<{enabledShiftAndWorkLog: boolean, inactivityTimeout: number}>} => Object with the global staff settings
	 * @param {Object} settings => Object with the global staff settings
	 * @param {boolean} settings.enabledShiftAndWorkLog => The client enabled the use of shift and work log
	 * @param {number} settings.inactivityTimeout => time configured by the client to detect if the user is inactive or not
	 */

	async getGlobalStaffSettings() {
		const {enabledShiftAndWorkLog = false, inactivityTimeout = 0} =
			(await StaffService.getSettings()) || {};

		return {
			enabledShiftAndWorkLog,
			inactivityTimeout,
		};
	}

	/**
	 * Open a work shift in the staff MS and record this event in the time tracking database.
	 * @param {Object} params
	 * @throws {Error} error
	 * @returns {Promise<string>} shiftId => ID related to the shift that has just been opened for the user
	 */

	async open({warehouseId = ''} = {}) {
		try {
			Crashlytics.log('openShift:');

			if (!this.hasStaffAuthorization) {
				this._throwAuthorizationError();
			}

			const {result: shift} = await StaffService.openShift({warehouseId});
			const {id: shiftId = ''} = shift || {};
			const shiftData = await this.getUserOpenShift({id: shiftId});

			this.id = shiftId;
			this.data = shiftData;
			this._changeStatus('opened');

			return shiftId;
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(
				parsedError,
				'An error occurred while trying to open a shift for the user'
			);
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Update the shift data in the staff MS and record this change in shift database.
	 * @param {Object} params
	 * @param {string} params.warehouseId => Warehouse ID related to the shift
	 * @throws {Error} error
	 * @returns {Promise<string>} shiftId => ID related to the shift that has just been updated for the user
	 */

	async update({warehouseId = ''} = {}) {
		try {
			Crashlytics.log('[updateShift]:');

			if (!this.hasStaffAuthorization) {
				this._throwAuthorizationError();
			}

			if (await this.isClosed()) return null;

			// Avoid unnecessary updates if warehouseId hasn't changed
			if (this.data?.warehouseId === warehouseId) {
				return this.id;
			}

			const {result: shift} = await StaffService.updateShift({warehouseId});
			const {id: shiftId = ''} = shift || {};

			this.data = {
				...this.data,
				warehouseId,
			};

			return shiftId;
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(
				parsedError,
				'[updateShift]: An error occurred while trying to update the shift'
			);
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Finish a work shift in the staff MS and record this event in the time tracking database.
	 * @param {Object} params
	 * @throws {Error} error
	 * @returns {Promise<string>} shiftId => ID related to the shift that has just been closed for the user
	 */

	async finish({date} = {}) {
		try {
			Crashlytics.log('closeShift:');

			if (!this.hasStaffAuthorization) {
				this._throwAuthorizationError();
			}

			if (await this.isClosed()) {
				await this.reOpen();
			}

			if (this.hasPendingData) {
				await this.sendPendingWorkLogs();
			}

			const endDate = isValidDate(date) ? parseToISOString(date) : new Date().toISOString();
			const {result: shift} = await StaffService.closeShift({endDate});
			const {id: shiftId = ''} = shift || {};

			this.data = {
				...this.data,
				endDate,
			};

			return shiftId;
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, 'An error occurred while trying to close user shift');
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Open a work log in the staff MS and record this event in the time tracking database.
	 * @param {Object} workLog
	 * @param {string} workLog.referenceId => Reference ID related to the work log
	 * @param {string} workLog.name => Name related to the work log
	 * @param {string} workLog.type => Type related to the work log
	 * @param {number} workLog.suggestedTime => Suggested time related to the work log
	 * @param {string|number} workLog.startDate => Start date related to the work log. Accepts an ISO 8601 string in UTC format with milliseconds (e.g. "2026-03-05T10:00:00.000Z") or milliseconds since epoch (e.g. 1709636400000). Defaults to current date if omitted or invalid.
	 * @throws {Error} error
	 * @returns {Promise<string>} workLogId => ID related to the work log that has just been opened for the user
	 */

	async openWorkLog(workLog = {}) {
		let previousWorkLog = {};
		let openWorkLog = {};

		try {
			Crashlytics.log('openWorkLog:', workLog);

			if (!ShiftWorklogs.isValidWorkLog(workLog)) {
				throw new Error('must provide a valid activity to open a work log');
			}

			if (!this.hasStaffAuthorization) {
				this._throwAuthorizationError();
			}

			openWorkLog = {...workLog};

			openWorkLog.startDate = isValidDate(openWorkLog.startDate)
				? parseToISOString(openWorkLog.startDate)
				: new Date().toISOString();

			delete openWorkLog.endDate;

			if (this.hasWorkLogInProgress) {
				const {startDate, ...currentRest} = this.getCurrentWorkLog();

				if (startDate > openWorkLog.startDate) {
					throw new Error(
						"The new activity's start date is earlier than previous activity start date."
					);
				}

				previousWorkLog = {
					...currentRest,
					endDate: openWorkLog.startDate,
				};
			}

			if (this._hasToPause(openWorkLog.referenceId)) {
				this._changeStatus('paused');
			}

			openWorkLog.id = ShiftWorklogs.createId(openWorkLog.referenceId);
			this.setCurrentWorkLog(openWorkLog);

			const hasInternet = await isInternetReachable();

			if (!hasInternet) {
				this._saveOffLineWorkLogs([previousWorkLog, openWorkLog]);
				return openWorkLog.id;
			}

			if (await this.isClosed()) {
				await this.reOpen();
			}

			if (this.hasPendingData) {
				const offLineWorkLogs = this._getOffLineWorkLogs();
				await this._sendWorkLogs([...offLineWorkLogs, previousWorkLog, openWorkLog]);
				OfflineData.deleteAll();
				return openWorkLog.id;
			}

			await this._sendWorkLogs([previousWorkLog, openWorkLog]);

			return openWorkLog.id;
		} catch (error) {
			if (isApiError(error) || isNetworkError(error)) {
				this._saveOffLineWorkLogs([previousWorkLog, openWorkLog]);
			}

			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, 'An error occurred while trying to open user workLog');
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Finish a work log in the staff MS and record this event in the time tracking database.
	 * @param {Object} workLog
	 * @param {string} workLog.referenceId => Reference ID related to the work log
	 * @param {string|number} workLog.endDate => End date related to the work log. Accepts an ISO 8601 string in UTC format with milliseconds (e.g. "2026-03-05T10:00:00.000Z") or milliseconds since epoch (e.g. 1709636400000). Defaults to current date if omitted or invalid.
	 * @throws {Error} error
	 * @returns {Promise<string>} workLogId => ID related to the work log that has just been closed for the user
	 */

	async finishWorkLog(workLog = {}) {
		let finishWorkLog = {};

		try {
			Crashlytics.log('finishWorkLog:', workLog);

			if (!ShiftWorklogs.isValidWorkLog(workLog)) {
				throw new Error('must provide a valid activity to close a work log');
			}

			if (!this.hasStaffAuthorization) {
				this._throwAuthorizationError();
			}

			finishWorkLog = {...workLog};

			const currentWorkLog = this.getCurrentWorkLog();

			if (!ShiftWorklogs.isValidWorkLog(currentWorkLog)) {
				throw new Error('There is no active worklog to close');
			}

			if (currentWorkLog?.referenceId !== finishWorkLog.referenceId) {
				throw new Error(
					'The worklog you are trying to close is different from the one that is currently open.'
				);
			}

			finishWorkLog.endDate = isValidDate(finishWorkLog.endDate)
				? parseToISOString(finishWorkLog.endDate)
				: new Date().toISOString();
			delete finishWorkLog.startDate;

			if (currentWorkLog?.startDate > finishWorkLog.endDate) {
				throw new Error("The activity's end date is earlier than its start date.");
			}

			if (this.isPaused) {
				this._changeStatus('opened');
			}

			const hasInternet = await isInternetReachable();

			if (!hasInternet) {
				this._saveOffLineWorkLogs([finishWorkLog]);
				this.deleteCurrentWorkLog();
				return finishWorkLog.id;
			}

			if (await this.isClosed()) {
				await this.reOpen();
			}

			/* istanbul ignore next */
			if (this.hasPendingData) {
				const offLineWorkLogs = this._getOffLineWorkLogs();
				await this._sendWorkLogs([...offLineWorkLogs, finishWorkLog]);
				OfflineData.deleteAll();
				this.deleteCurrentWorkLog();
				return finishWorkLog.id;
			}

			await this._sendWorkLogs([finishWorkLog]);
			this.deleteCurrentWorkLog();

			return finishWorkLog.id;
		} catch (error) {
			if (isApiError(error) || isNetworkError(error)) {
				this._saveOffLineWorkLogs([finishWorkLog]);
				this.deleteCurrentWorkLog();
			}
			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, 'An error occurred while trying to close user workLog');
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Get the current work log data
	 * @returns {Object} currentWorkLog => The current work log
	 */

	getCurrentWorkLog() {
		const id = Storage.get(CURRENT_WORKLOG_ID);
		const data = Storage.get(CURRENT_WORKLOG_DATA);

		return {
			...(!!id && {id}),
			...(ShiftWorklogs.isValidWorkLog(data) && {...data}),
		};
	}

	/**
	 * Set the current work log data
	 * @param {Object} workLog => The work log data to set
	 */

	setCurrentWorkLog(workLog = {}) {
		const {suggestedTime = 0, id, startDate} = workLog;
		const suggestedFinishDate = new Date(startDate).getTime() + suggestedTime * 60 * 1000;
		const currentWorkLog = {
			...workLog,
			shiftId: this.id,
			suggestedFinishDate: new Date(suggestedFinishDate).toISOString(),
		};
		Storage.set(CURRENT_WORKLOG_ID, id);
		Storage.set(CURRENT_WORKLOG_DATA, currentWorkLog);
	}

	/**
	 * Delete the current work log data
	 */

	deleteCurrentWorkLog() {
		Storage.remove(CURRENT_WORKLOG_ID);
		Storage.remove(CURRENT_WORKLOG_DATA);
	}

	/**
	 * Send pending work logs to the staff MS
	 * @throws {Error} error
	 * @returns {Promise<null>} null
	 */

	async sendPendingWorkLogs() {
		try {
			Crashlytics.log('sendPendingWorkLogs:');

			if (!this.hasStaffAuthorization) {
				this._throwAuthorizationError();
			}

			if (!this.hasPendingData) return null;

			const storageData = this._getOffLineWorkLogs();
			const formattedWorkLogs = ShiftWorklogs.formatForJanis(storageData);

			if (isEmptyArray(formattedWorkLogs)) return null;

			if (await this.isClosed()) {
				await this.reOpen();
			}

			await ShiftWorklogs.batch(formattedWorkLogs);
			OfflineData.deleteAll();
			return null;
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, 'Error posting pending work logs');
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Get the open shift for a user
	 * @param {Object} params
	 * @param {string} params.userId => ID related to the user
	 * @param {string} params.id => ID related to the shift
	 * @throws {Error} error
	 * @returns {Promise<Object>} shift => The open shift for the user
	 */

	async getUserOpenShift(params = {}) {
		try {
			Crashlytics.log('getUserOpenShift:', params);

			if (!this.hasStaffAuthorization) {
				this._throwAuthorizationError();
			}

			const {userId, id, ...rest} = params;
			const {result: shifts} = await StaffService.getShiftsList({
				filters: {
					userId,
					status: 'opened',
					...(!!id && {id}),
					...rest,
				},
			});
			const [openShift] = shifts || [];

			return openShift || {};
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, 'Error getting open shift in staff service');
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Get the work logs for a shift
	 * @param {string} shiftId => ID related to the shift
	 * @throws {Error} error
	 * @returns {Promise<Array>} workLogs => Array of work logs
	 */

	async getWorkLogs(shiftId) {
		try {
			Crashlytics.log('getWorkLogs:');

			if (!this.hasStaffAuthorization) {
				this._throwAuthorizationError();
			}

			const userShiftId = shiftId || this.id;

			if (!userShiftId) throw new Error('Shift ID not found');

			const workLogs = await ShiftWorklogs.getList(userShiftId);

			return Formatter.formatWorkLogsFromJanis(workLogs);
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(
				parsedError,
				'An error occurred while trying to get user workLogs from staff service'
			);
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Re open current shift in the staff MS and extend storage shift closing date.
	 * @throws {Error} error
	 * @returns {Promise<null>} null
	 */

	async reOpen() {
		try {
			Crashlytics.log('reOpenShift:');

			if (!this.hasStaffAuthorization) {
				this._throwAuthorizationError();
			}

			if (this.isExpired()) {
				this._changeStatus('closed');
				throw new Error('The deadline for ending the shift has been exceeded');
			}

			await StaffService.openShift({warehouseId: this.data?.warehouseId});
			this._changeStatus('opened');
			this._extendShiftClosingDate();

			return null;
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, 'An error occurred while trying to re open user shift');
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Check if the shift closing date has been exceeded
	 * @returns {Promise<boolean>} true if the shift closing date has been exceeded, false otherwise
	 */

	async isClosed() {
		const currentShift = (await this.getUserOpenShift({id: this.id})) || {};
		return currentShift?.status !== 'opened';
	}

	/**
	 * Check if the shift maximum closing date has been exceeded
	 * @returns {boolean} true if the shift maximum closing date has been exceeded, false otherwise
	 */

	isExpired() {
		return new Date(this.data?.dateMaxToClose).getTime() < new Date().getTime();
	}

	/**
	 * Fetch the work log types from the staff MS and prepare them for register an activity.
	 * @throws {Error} error
	 * @returns {Promise<Array>} workLogTypes => Array of work log types
	 */

	async fetchWorklogTypes() {
		try {
			Crashlytics.log('fetchWorklogTypes:');

			if (!this.hasStaffAuthorization) {
				this._throwAuthorizationError();
			}

			const {result: workLogTypes = []} = await StaffService.getWorkLogTypes();

			return Formatter.formatWorkLogTypes(workLogTypes);
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, 'Error fetching worklog types from staff service');
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Delete all registers related to the shift in the time tracking database.
	 * @throws {Error} error
	 * @returns {Promise<boolean>} true => if the registers were deleted successfully
	 */

	async deleteShiftRegisters() {
		try {
			Crashlytics.log('deleteShiftRegisters:');
			this._deleteShiftData();
			this.deleteCurrentWorkLog();
			return OfflineData.deleteAll();
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(
				parsedError,
				'An error occurred while trying to delete shift storage data'
			);
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Reset the inactivity counter
	 */

	resetInactivityTimer() {
		if (!this.hasStaffAuthorization) return;

		ShiftInactivity.resetTimer();
	}

	/**
	 * Stop the inactivity counter
	 */

	stopInactivityTimer() {
		if (!this.hasStaffAuthorization) return;

		ShiftInactivity.stopTimer();
	}

	/**
	 * @private
	 * Send the work logs to the staff MS
	 * @param {Array} workLogs => Array of work logs
	 */

	async _sendWorkLogs(workLogs = []) {
		const formattedWorkLogs = ShiftWorklogs.formatForJanis(workLogs);

		await ShiftWorklogs.batch(formattedWorkLogs);
	}

	/**
	 * @private
	 * Save the offline work logs to the storage
	 * @param {Array} workLogs => Array of work logs
	 */

	_saveOffLineWorkLogs(workLogs) {
		workLogs = isArray(workLogs) ? workLogs : [workLogs];

		/* istanbul ignore next */
		workLogs.forEach((workLog) => {
			const {id, referenceId, startDate, endDate} = workLog || {};

			if (!id || !referenceId) return;

			OfflineData.save(id, {
				referenceId,
				...(!!startDate && {startDate}),
				...(!!endDate && {endDate}),
			});
		});
	}

	/**
	 * @private
	 * Get the offline work logs from the storage
	 * @returns {Array} workLogs => Array of work logs
	 */

	_getOffLineWorkLogs() {
		return OfflineData.get();
	}

	/**
	 * @private
	 * Check if the work log should be paused
	 * @param {string} workLogReferenceId => Reference ID related to the work log
	 * @returns {boolean} true if the work log should be paused, false otherwise
	 */

	_hasToPause(workLogReferenceId) {
		return workLogReferenceId && !EXCLUDED_WORKLOG_TYPES.includes(workLogReferenceId);
	}

	/**
	 * @private
	 * Change the shift status
	 * @param {string} status => The status to set
	 */

	_changeStatus(status) {
		const allowedStatuses = ['opened', 'paused', 'closed'];

		/* istanbul ignore next */
		if (!allowedStatuses.includes(status)) {
			throw new Error(
				`Invalid shift status: ${status}. Allowed statuses are: ${allowedStatuses.join(', ')}`
			);
		}

		this.status = status;
	}

	/**
	 * @private
	 * Delete the shift data from the storage
	 */

	_deleteShiftData() {
		Storage.remove(SHIFT_ID);
		Storage.remove(SHIFT_STATUS);
		Storage.remove(SHIFT_DATA);
	}

	/**
	 * @private
	 * Extend the shift closing date.
	 * @throws {Error} error
	 * @returns {Promise<null>} null
	 */

	_extendShiftClosingDate() {
		const shiftData = this.data; // reopeningExtensionTime is in minutes
		const {dateToClose, reopeningExtensionTime} = shiftData;
		let extensionTime = DEFAULT_REOPENING_EXTENSION_TIME;

		if (reopeningExtensionTime && isNumber(reopeningExtensionTime)) {
			extensionTime = reopeningExtensionTime * 60 * 1000; // Convert minutes to milliseconds
		}

		const updatedClosingDate = new Date(dateToClose).getTime() + extensionTime; // Add the extension time to the closing date

		this.data = {
			...shiftData,
			dateToClose: new Date(updatedClosingDate).toISOString(),
		};
	}

	/**
	 * @private
	 * Throw an error if the user does not have staff authorization
	 * @throws {Error} error
	 */

	_throwAuthorizationError() {
		throw new Error('Staff MS authorization is required');
	}
}

export default new Shift();
