import StaffService from './StaffApiServices';
import Storage from './db/StorageService';
import Crashlytics from './utils/crashlytics';
import ShiftWorklogs from './ShiftWorklogs';
import errorParser from './utils/errorParser';
import {
	isArray,
	isEmptyArray,
	isNumber,
	isValidObject,
	isApiError,
	isInternetReachable,
} from './utils/helpers';
import {getStaffAuthorizationData} from './utils/storage';
import {
	SHIFT_ID,
	SHIFT_STATUS,
	SHIFT_DATA,
	CURRENT_WORKLOG_DATA,
	CURRENT_WORKLOG_ID,
	EXCLUDED_WORKLOG_TYPES,
	DEFAULT_REOPENING_EXTENSION_TIME,
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

	get hasStaffAuthorize() {
		const {hasStaffAuthorization} = getStaffAuthorizationData();
		return hasStaffAuthorization;
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
		try {
			const {result: setting} = await StaffService.getSetting('global');

			const {enabledShiftAndWorkLog = false} = setting || {};

			return enabledShiftAndWorkLog;
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, 'Error checking staff MS authorization');
			return Promise.reject(parsedError);
		}
	}

	/**
	 * Open a work shift in the staff MS and record this event in the time tracking database.
	 * @param {Object} params
	 * @throws {Error} error
	 * @returns {Promise<string>} shiftId => ID related to the shift that has just been opened for the user
	 */

	async open() {
		try {
			Crashlytics.log('openShift:');

			if (!this.hasStaffAuthorize) {
				this._throwAuthorizationError();
			}

			const {result: shift} = await StaffService.openShift();
			const {id: shiftId = ''} = shift || {};
			const shiftData = await this.getUserOpenShift({id: shiftId});

			this.id = shiftId;
			this.data = shiftData;
			this.status = 'opened';

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
	 * Finish a work shift in the staff MS and record this event in the time tracking database.
	 * @param {Object} params
	 * @throws {Error} error
	 * @returns {Promise<string>} shiftId => ID related to the shift that has just been closed for the user
	 */

	async finish({date} = {}) {
		try {
			Crashlytics.log('closeShift:');

			if (!this.hasStaffAuthorize) {
				this._throwAuthorizationError();
			}

			if (this.isClosed()) {
				await this.reOpen();
			}

			if (this.hasPendingData) {
				await this.sendPendingWorkLogs();
			}

			const {result: shift} = await StaffService.closeShift();
			const {id: shiftId = ''} = shift || {};
			const endDate = date || new Date().toISOString();

			this.status = 'closed';
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
	 * @throws {Error} error
	 * @returns {Promise<string>} workLogId => ID related to the work log that has just been opened for the user
	 */

	async openWorkLog(workLog = {}) {
		let previousWorkLog = {};
		const currentDate = new Date().toISOString();

		try {
			Crashlytics.log('openWorkLog:', workLog);

			if (!isValidObject(workLog)) return null;

			if (!this.hasStaffAuthorize) {
				this._throwAuthorizationError();
			}

			if (this.hasWorkLogInProgress) {
				const {startDate, ...currentRest} = this.getCurrentWorkLog();
				previousWorkLog = {
					...currentRest,
					endDate: currentDate,
				};
			}

			if (this._hasToPause(workLog.referenceId)) {
				this.status = 'paused';
			}

			workLog.id = ShiftWorklogs.createId(workLog.referenceId);
			workLog.startDate = currentDate;
			this.setCurrentWorkLog(workLog);

			const hasInternet = await isInternetReachable();

			if (!hasInternet) {
				this._saveOffLineWorkLogs([previousWorkLog, workLog]);
				return workLog.id;
			}

			if (this.isClosed()) {
				await this.reOpen();
			}

			if (this.hasPendingData) {
				const offLineWorkLogs = this._getOffLineWorkLogs();
				await this._sendWorkLogs([...offLineWorkLogs, previousWorkLog, workLog]);
				OfflineData.deleteAll();
				return workLog.id;
			}

			await this._sendWorkLogs([previousWorkLog, workLog]);

			return workLog.id;
		} catch (error) {
			if (isApiError(error)) {
				this._saveOffLineWorkLogs([previousWorkLog, workLog]);
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
	 * @throws {Error} error
	 * @returns {Promise<string>} workLogId => ID related to the work log that has just been closed for the user
	 */

	async finishWorkLog(workLog = {}) {
		try {
			Crashlytics.log('finishWorkLog:', workLog);

			if (!isValidObject(workLog)) return null;

			if (!this.hasStaffAuthorize) {
				this._throwAuthorizationError();
			}

			const currentWorkLog = this.getCurrentWorkLog();

			if (!isValidObject(currentWorkLog)) {
				throw new Error('There is no active worklog to close');
			}

			if (currentWorkLog?.referenceId !== workLog.referenceId) {
				throw new Error(
					'The worklog you are trying to close is different from the one that is currently open.'
				);
			}

			workLog.endDate = new Date().toISOString();
			workLog.startDate = null;

			if (this.isPaused) {
				this.status = 'opened';
			}

			const hasInternet = await isInternetReachable();

			if (!hasInternet) {
				this._saveOffLineWorkLogs([workLog]);
				this.deleteCurrentWorkLog();
				return workLog.id;
			}

			if (this.isClosed()) {
				await this.reOpen();
			}

			/* istanbul ignore next */
			if (this.hasPendingData) {
				const offLineWorkLogs = this._getOffLineWorkLogs();
				await this._sendWorkLogs([...offLineWorkLogs, workLog]);
				OfflineData.deleteAll();
				this.deleteCurrentWorkLog();
				return workLog.id;
			}

			await this._sendWorkLogs([workLog]);
			this.deleteCurrentWorkLog();

			return workLog.id;
		} catch (error) {
			if (isApiError(error)) {
				this._saveOffLineWorkLogs([workLog]);
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
			...(isValidObject(data) && {...data}),
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

			if (!this.hasStaffAuthorize) {
				this._throwAuthorizationError();
			}

			if (!this.hasPendingData) return null;

			const storageData = this._getOffLineWorkLogs();
			const formatedWorkLogs = ShiftWorklogs.formatForJanis(storageData);

			if (isEmptyArray(formatedWorkLogs)) return null;

			if (this.isClosed()) {
				await this.reOpen();
			}

			await ShiftWorklogs.batch(formatedWorkLogs);
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

			if (!this.hasStaffAuthorize) {
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

			if (!this.hasStaffAuthorize) {
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

			if (!this.hasStaffAuthorize) {
				this._throwAuthorizationError();
			}

			if (this.isExpired()) {
				this.status = 'closed';
				throw new Error('The deadline for ending the shift has been exceeded');
			}

			await StaffService.openShift();
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
	 * @returns {boolean} true if the shift closing date has been exceeded, false otherwise
	 */

	isClosed() {
		return new Date(this.data?.dateToClose).getTime() < new Date().getTime();
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

			if (!this.hasStaffAuthorize) {
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
