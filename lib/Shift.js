import TimeTracker from './db/TimeTrackerService';
import StaffService from './StaffApiServices';
import Storage from './db/StorageService';
import Crashlytics from './utils/crashlytics';
import ShiftWorklogs from './ShiftWorklogs';
import {generateRandomId, isEmptyArray, isEmptyObject, isNumber, isObject} from './utils/helpers';
import {getObject, getShiftData, getStaffAuthorizationData, setObject} from './utils/storage';
import {
	SHIFT_ID,
	SHIFT_STATUS,
	SHIFT_DATA,
	CURRENT_WORKLOG_DATA,
	CURRENT_WORKLOG_ID,
	EXCLUDED_WORKLOG_TYPES,
	DEFAULT_REOPENING_EXTENSION_TIME,
} from './constant';
import TrackerRecords from './TrackerRecords';
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
			Crashlytics.recordError(error, 'Error checking staff MS authorization');
			return Promise.reject(error);
		}
	}

	/**
	 * Open a work shift in the staff MS and record this event in the time tracking database.
	 * @param {Object} params
	 * @throws {Error} error
	 * @returns {Promise<string>} shiftId => ID related to the shift that has just been opened for the user
	 */

	async open(params = {}) {
		try {
			Crashlytics.log('user open shift');

			this._requireStaffAuthorization();

			const {date} = params;
			const {result: shift} = await StaffService.openShift();
			const {id: shiftId = ''} = shift || {};

			const openShift = await this.getUserOpenShift({id: shiftId});

			await this._startTracking({
				id: shiftId,
				date: date || openShift.startDate,
			});

			Storage.set(SHIFT_ID, shiftId);
			Storage.set(SHIFT_STATUS, 'opened');
			Storage.set(SHIFT_DATA, JSON.stringify(openShift));

			return shiftId;
		} catch (error) {
			Crashlytics.recordError(error, 'Error opening shift in staff service');
			return Promise.reject(error);
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
			Crashlytics.log('user close shift');

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

			await this._finishTracking({id: shiftId, date});

			const updatedShiftData = {
				...shiftData,
				endDate,
			};

			Storage.set(SHIFT_STATUS, 'closed');
			Storage.set(SHIFT_DATA, JSON.stringify(updatedShiftData));

			return shiftId;
		} catch (error) {
			Crashlytics.recordError(error, 'Error closing shift in staff service');
			return Promise.reject(error);
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
			Crashlytics.log('user open shift worklog', workLog);

			this._requireStaffAuthorization();

			if (!isObject(workLog) || isEmptyObject(workLog)) return null;

			const {referenceId, name, type, suggestedTime = 0} = workLog;
			const shiftId = Storage.getString(SHIFT_ID);
			const startTime = new Date().toISOString();
			const randomId = generateRandomId();

			const workLogId = Formatter.formatWorkLogId(referenceId, randomId);

			// TODO: uncomment this when resolve how to handle offline workLogs
			// await ShiftWorklogs.open({
			// 	referenceId,
			// 	startDate: startTime,
			// });

			const dataForTimeTracker = {
				type,
				name,
				shiftId,
				referenceId,
			};

			OfflineData.save(workLogId, {
				referenceId,
				startDate: startTime,
			});

			await this._startTracking({
				id: workLogId,
				date: startTime,
				payload: dataForTimeTracker,
			});

			const suggestedFinishDate = new Date(startTime).getTime() + suggestedTime * 60 * 1000;

			const dataForStorage = {
				...dataForTimeTracker,
				suggestedFinishDate: new Date(suggestedFinishDate).toISOString(),
				suggestedTime,
				startDate: startTime,
			};

			if (!EXCLUDED_WORKLOG_TYPES.includes(referenceId)) {
				Storage.set(SHIFT_STATUS, 'paused');
			}

			Storage.set(CURRENT_WORKLOG_ID, workLogId);
			Storage.set(CURRENT_WORKLOG_DATA, JSON.stringify(dataForStorage));

			return workLogId;
		} catch (error) {
			Crashlytics.recordError(error, 'Error opening shift worklog');
			return Promise.reject(error);
		}
	}

	/**
	 * Finish a work log in the staff MS and record this event in the time tracking database.
	 * @param {Object} workLog
	 * @param {string} workLog.referenceId => Reference ID related to the work log
	 * @param {string} workLog.name => Name related to the work log
	 * @param {string} workLog.type => Type related to the work log
	 * @throws {Error} error
	 * @returns {Promise<string>} workLogId => ID related to the work log that has just been closed for the user
	 */

	async finishWorkLog(workLog = {}) {
		try {
			Crashlytics.log('user close shift worklog', workLog);

			this._requireStaffAuthorization();

			if (!isObject(workLog) || isEmptyObject(workLog)) return null;

			const {referenceId, name, type} = workLog;
			const shiftId = Storage.getString(SHIFT_ID);
			const shiftStatus = Storage.getString(SHIFT_STATUS);
			const endTime = new Date().toISOString();
			const workLogId = Storage.getString(CURRENT_WORKLOG_ID);

			// TODO: uncomment this when resolve how to handle offline workLogs
			// await ShiftWorklogs.finish({
			// 	referenceId,
			// 	endDate: endTime,
			// });

			const dataForTimeTracker = {
				type,
				name,
				shiftId,
				referenceId,
			};

			OfflineData.save(workLogId, {
				referenceId,
				endDate: endTime,
			});

			await this._finishTracking({
				id: workLogId,
				date: endTime,
				payload: dataForTimeTracker,
			});

			if (shiftStatus === 'paused') {
				Storage.set(SHIFT_STATUS, 'opened');
			}

			this._deleteCurrentWorkLogData();

			return workLogId;
		} catch (error) {
			Crashlytics.recordError(error, 'Error closing shift worklog');
			return Promise.reject(error);
		}
	}

	async sendPendingWorkLogs() {
		try {
			Crashlytics.log('user send pending work logs');

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
			Crashlytics.log('user get open shift', params);

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
			Crashlytics.recordError(error, 'Error getting open shift in staff service');
			return Promise.reject(error);
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
			Crashlytics.log('user get work logs');

			this._requireStaffAuthorization();

			const userShiftId = shiftId || Storage.getString(SHIFT_ID);

			if (!userShiftId) throw new Error('Shift ID not found');

			const workLogs = await ShiftWorklogs.getList(userShiftId);

			return Formatter.formatWorkLogsFromJanis(workLogs);
		} catch (error) {
			Crashlytics.recordError(error, 'Error getting work logs in staff service');
			return Promise.reject(error);
		}
	}

	/**
	 * Re open current shift in the staff MS and extend storage shift closing date.
	 * @throws {Error} error
	 * @returns {Promise<null>} null
	 */

	async reOpen() {
		try {
			Crashlytics.log('user re open shift');

			this._requireStaffAuthorization();

			const shiftIsExpired = this.isDateMaxToCloseExceeded();

			if (shiftIsExpired) {
				throw new Error('The deadline for ending the shift has been exceeded');
			}
			await StaffService.openShift();
			this._extendShiftClosingDate();

			return null;
		} catch (error) {
			Crashlytics.recordError(error, 'Error re opening shift');
			return Promise.reject(error);
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
	 * Gets a shift report based on the shift ID and its registered events.
	 *
	 * The report includes information about performed activities, start and end times,
	 * total elapsed time, work time and pause time.
	 *
	 * @async
	 * @function getReport
	 * @throws {Error} If the `shiftId` is not found in storage.
	 * @returns {Promise<{
	 *   activities: Array<{
	 *     id: string,
	 *     name: string,
	 *     type: string,
	 *     startDate: string,
	 *     endDate: string,
	 *     duration: number
	 *   }>,
	 *   startDate: string,
	 *   endDate: string,
	 *   elapsedTime: number,
	 *   workTime: number,
	 *   pauseTime: number,
	 *   isComplete: boolean,
	 *   error: string | null
	 * }>} Object with shift details.
	 *
	 * @property {Array} activities - List of activities registered during the shift.
	 * @property {string} activities[].id - Unique identifier of the activity.
	 * @property {string} activities[].name - Name or description of the activity.
	 * @property {string} activities[].startDate - Start date and time of the activity.
	 * @property {string} activities[].endDate - End date and time of the activity.
	 * @property {number} activities[].duration - Duration of the activity in milliseconds.
	 * @property {string} startDate - Start date and time of the shift.
	 * @property {string} endDate - End date and time of the shift (can be empty if not finished).
	 * @property {number} elapsedTime - Total elapsed time between shift start and end.
	 * @property {number} workTime - Effective work time (total time minus pauses).
	 * @property {number} pauseTime - Total time of registered pauses.
	 * @property {boolean} isComplete - Indicates if the report was obtained completely without errors.
	 * @property {string|null} error - Error message if the report is not complete, or null if there were no errors.
	 */

	async getReport() {
		try {
			Crashlytics.log('user get shift report');
			const shiftId = Storage.getString(SHIFT_ID);

			if (!shiftId) throw new Error('Shift ID is required');

			const startDate = await TrackerRecords.getStartDateById(shiftId);
			const endDate = await TrackerRecords.getEndDateById(shiftId);
			const workLogs = await ShiftWorklogs.getShiftTrackedWorkLogs(shiftId);

			const activities = Formatter.formatShiftActivities(workLogs);
			const elapsedTime = TimeTracker.getElapsedTime({
				startTime: startDate,
				...(!!endDate && {endTime: endDate}),
				format: false,
			});

			const pauseTime = activities.reduce((acc, activity) => acc + (activity?.duration || 0), 0);
			const workTime = elapsedTime - pauseTime;

			return {
				activities,
				startDate,
				endDate,
				elapsedTime,
				workTime,
				pauseTime,
			};
		} catch (reason) {
			Crashlytics.recordError(reason, 'Error getting shift report');
			return Promise.reject(reason);
		}
	}

	/**
	 * Fetch the work log types from the staff MS and prepare them for register an activity.
	 * @throws {Error} error
	 * @returns {Promise<Array>} workLogTypes => Array of work log types
	 */

	async fetchWorklogTypes() {
		try {
			Crashlytics.log('user fetch worklog types');

			this._requireStaffAuthorization();

			const {result: workLogTypes = []} = await StaffService.getWorkLogTypes();

			return Formatter.formatWorkLogTypes(workLogTypes);
		} catch (error) {
			Crashlytics.recordError(error, 'Error fetching worklog types in staff service');
			return Promise.reject(error);
		}
	}

	/**
	 * Delete all registers related to the shift in the time tracking database.
	 * @throws {Error} error
	 * @returns {Promise<boolean>} true => if the registers were deleted successfully
	 */

	async deleteShiftRegisters() {
		try {
			Crashlytics.log('user delete shift registers');
			this._deleteShiftData();
			this._deleteCurrentWorkLogData();
			OfflineData.deleteAll();
			return await TimeTracker.deleteAllEvents();
		} catch (error) {
			Crashlytics.recordError(error, 'Error deleting registers from shift tracking database');
			return Promise.reject(error);
		}
	}

	_deleteShiftData() {
		Storage.delete(SHIFT_ID);
		Storage.delete(SHIFT_STATUS);
		Storage.delete(SHIFT_DATA);
	}

	_deleteCurrentWorkLogData() {
		Storage.delete(CURRENT_WORKLOG_ID);
		Storage.delete(CURRENT_WORKLOG_DATA);
	}

	/**
	 * @private
	 * Start id tracking in the time tracking database.
	 * @param {Object} params
	 * @param {string} params.id => ID related to the shift
	 * @param {string} params.date => Date related to the shift
	 * @param {Object} params.payload => Payload related to the shift
	 */

	async _startTracking(params) {
		const {id, date, payload} = params;
		await TimeTracker.addEvent({
			id,
			time: date || new Date().toISOString(),
			type: 'start',
			payload,
		}).catch(() => null);
	}

	/**
	 * @private
	 * Finish id tracking in the time tracking database.
	 * @param {Object} params
	 * @param {string} params.id => ID related to the shift
	 * @param {string} params.date => Date related to the shift
	 * @param {Object} params.payload => Payload related to the shift
	 */

	async _finishTracking(params) {
		const {id, date, payload} = params;
		await TimeTracker.addEvent({
			id,
			time: date || new Date().toISOString(),
			type: 'finish',
			payload,
		}).catch(() => null);
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
}
export default new Shift();
