import StaffService from './StaffApiServices';
import Storage from './db/StorageService';
import Crashlytics from './utils/crashlytics';
import ShiftWorklogs from './ShiftWorklogs';
import errorParser from './utils/errorParser';
import {
	generateRandomId,
	isEmptyArray,
	isEmptyObject,
	isNumber,
	isObject,
	isValidObject,
} from './utils/helpers';
import {
	deleteStoredWorkLog,
	getObject,
	getShiftData,
	getStaffAuthorizationData,
	setObject,
} from './utils/storage';
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

			this._requireStaffAuthorization();

			const {result: shift} = await StaffService.openShift();
			const {id: shiftId = ''} = shift || {};

			const openShift = await this.getUserOpenShift({id: shiftId});

			Storage.set(SHIFT_ID, shiftId);
			Storage.set(SHIFT_STATUS, 'opened');
			setObject(SHIFT_DATA, openShift);

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

	async finish(params = {}) {
		try {
			Crashlytics.log('closeShift:');

			this._requireStaffAuthorization();

			const shiftIsExpired = this.isDateToCloseExceeded();

			if (shiftIsExpired) {
				await this.reOpen();
			}

			if (this.hasPendingData) {
				await this.sendPendingWorkLogs();
			}

			const {date} = params;
			const {result: shift} = await StaffService.closeShift();
			const {id: shiftId = ''} = shift || {};
			const endDate = date || new Date().toISOString();
			const shiftData = getShiftData();

			const updatedShiftData = {
				...shiftData,
				endDate,
			};

			Storage.set(SHIFT_STATUS, 'closed');
			setObject(SHIFT_DATA, updatedShiftData);

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
		try {
			Crashlytics.log('openWorkLog:', workLog);

			this._requireStaffAuthorization();

			if (!isObject(workLog) || isEmptyObject(workLog)) return null;
			const currentTime = new Date().toISOString();
			const mustCloseLastWorkLog = this._isNeccesaryCloseLastWorkLog();

			if (mustCloseLastWorkLog) {
				const lastWorkLog = getObject(CURRENT_WORKLOG_DATA);

				await this.finishWorkLog(lastWorkLog);
			}

			const {referenceId, name, type, suggestedTime = 0} = workLog;
			const shiftId = Storage.getString(SHIFT_ID);
			const randomId = generateRandomId();

			const workLogId = Formatter.formatWorkLogId(referenceId, randomId);

			// TODO: uncomment this when resolve how to handle offline workLogs
			// await ShiftWorklogs.open({
			// 	referenceId,
			// 	startDate: currentTime,
			// });

			OfflineData.save(workLogId, {
				referenceId,
				startDate: currentTime,
			});

			const suggestedFinishDate = new Date(currentTime).getTime() + suggestedTime * 60 * 1000;

			const dataForStorage = {
				type,
				name,
				shiftId,
				referenceId,
				suggestedFinishDate: new Date(suggestedFinishDate).toISOString(),
				suggestedTime,
				startDate: currentTime,
			};

			if (!EXCLUDED_WORKLOG_TYPES.includes(referenceId)) {
				Storage.set(SHIFT_STATUS, 'paused');
			}

			Storage.set(CURRENT_WORKLOG_ID, workLogId);
			Storage.set(CURRENT_WORKLOG_DATA, JSON.stringify(dataForStorage));

			return workLogId;
		} catch (error) {
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

			this._requireStaffAuthorization();

			if (!isObject(workLog) || isEmptyObject(workLog)) return null;

			const currentWorkLog = getObject(CURRENT_WORKLOG_DATA);
			const {referenceId} = workLog;

			if (!isValidObject(currentWorkLog)) {
				throw new Error('There is no active worklog to close');
			}

			if (currentWorkLog?.referenceId !== referenceId) {
				throw new Error(
					'The worklog you are trying to close is different from the one that is currently open.'
				);
			}

			const shiftStatus = Storage.getString(SHIFT_STATUS);
			const endTime = new Date().toISOString();
			const workLogId = Storage.getString(CURRENT_WORKLOG_ID);
			// TODO: uncomment this when resolve how to handle offline workLogs
			// await ShiftWorklogs.finish({
			// 	referenceId,
			// 	endDate: endTime,
			// });

			OfflineData.save(workLogId, {
				referenceId,
				endDate: endTime,
			});

			if (shiftStatus === 'paused') {
				Storage.set(SHIFT_STATUS, 'opened');
			}

			deleteStoredWorkLog();

			return workLogId;
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, 'An error occurred while trying to close user workLog');
			return Promise.reject(parsedError);
		}
	}

	async sendPendingWorkLogs() {
		try {
			Crashlytics.log('sendPendingWorkLogs:');

			this._requireStaffAuthorization();

			const storageData = OfflineData.get();
			const formatedWorkLogs = Formatter.formatOfflineWorkLog(storageData);

			if (isEmptyArray(formatedWorkLogs)) return null;

			const shiftIsExpired = this.isDateToCloseExceeded();

			if (shiftIsExpired) {
				await this.reOpen();
			}

			await ShiftWorklogs.postPendingBatch(formatedWorkLogs);
			OfflineData.deleteAll();
			return null;
		} catch (error) {
			Crashlytics.recordError(error, 'Error posting pending work logs');
			return Promise.reject(error);
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

			this._requireStaffAuthorization();

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

			this._requireStaffAuthorization();

			const userShiftId = shiftId || Storage.getString(SHIFT_ID);

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

			this._requireStaffAuthorization();

			const shiftIsExpired = this.isDateMaxToCloseExceeded();

			if (shiftIsExpired) {
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

	isDateToCloseExceeded() {
		const shiftData = getObject(SHIFT_DATA);
		const {dateToClose} = shiftData;
		const currentDate = new Date();

		return new Date(dateToClose).getTime() < currentDate.getTime();
	}

	isDateMaxToCloseExceeded() {
		const shiftData = getObject(SHIFT_DATA);
		const {dateMaxToClose} = shiftData;
		const currentDate = new Date();

		return new Date(dateMaxToClose).getTime() < currentDate.getTime();
	}

	/**
	 * Fetch the work log types from the staff MS and prepare them for register an activity.
	 * @throws {Error} error
	 * @returns {Promise<Array>} workLogTypes => Array of work log types
	 */

	async fetchWorklogTypes() {
		try {
			Crashlytics.log('fetchWorklogTypes:');

			this._requireStaffAuthorization();

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
			deleteStoredWorkLog();
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

	_deleteShiftData() {
		Storage.delete(SHIFT_ID);
		Storage.delete(SHIFT_STATUS);
		Storage.delete(SHIFT_DATA);
	}

	/**
	 * @private
	 * Extend the shift closing date.
	 * @throws {Error} error
	 * @returns {Promise<null>} null
	 */

	_extendShiftClosingDate() {
		const shiftData = getObject(SHIFT_DATA);
		const {dateToClose, reopeningExtensionTime} = shiftData; // reopeningExtensionTime is in minutes
		let extensionTime = DEFAULT_REOPENING_EXTENSION_TIME;

		if (reopeningExtensionTime && isNumber(reopeningExtensionTime)) {
			extensionTime = reopeningExtensionTime * 60 * 1000; // Convert minutes to milliseconds
		}

		const updatedClosingDate = new Date(dateToClose).getTime() + extensionTime; // Add the extension time to the closing date

		shiftData.dateToClose = new Date(updatedClosingDate).toISOString();

		setObject(SHIFT_DATA, shiftData);
	}

	/**
	 * @private
	 * Validate if the user has staff MS authorization
	 * @throws {Error} error
	 * @returns {Promise<null>} null
	 */

	_requireStaffAuthorization() {
		if (this.hasStaffAuthorize) return;
		throw new Error('Staff MS authorization is required');
	}

	/**
	 * @private
	 * Validate if is neccesary close the last work log
	 * @param {Object} newWorkLog
	 * @param {string} newWorkLog.referenceId => Reference ID related to the new work log
	 * @returns {boolean} true if is neccesary close the last work log, false otherwise
	 */

	_isNeccesaryCloseLastWorkLog() {
		const lastWorkLog = OfflineData.getLastRecord();
		if (!isValidObject(lastWorkLog)) return false;

		const isLastWorkLogClosed = !!lastWorkLog?.endDate;

		return !isLastWorkLogClosed;
	}
}

export default new Shift();
