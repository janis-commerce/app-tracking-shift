import TimeTracker from './db/TimeTrackerService';
import StaffService from './StaffApiServices';
import Storage from './db/StorageService';
import Crashlytics from './utils/crashlytics';
import ShiftWorklogs from './ShiftWorklogs';
import {generateRandomId, isEmptyObject, isObject} from './utils/helpers';
import {getShiftData} from './utils/storage';
import {
	SHIFT_ID,
	SHIFT_STATUS,
	SHIFT_DATA,
	CURRENT_WORKLOG_DATA,
	CURRENT_WORKLOG_ID,
} from './constant';
import TrackerRecords from './TrackerRecords';
import Formatter from './Formatter';

/**
 * Class to manage work shifts
 * @class Shift
 */

class Shift {
	/**
	 * Open a work shift in the staff MS and record this event in the time tracking database.
	 * @param {Object} params
	 * @throws {Error} error
	 * @returns {Promise<string>} shiftId => ID related to the shift that has just been opened for the user
	 */

	async open(params = {}) {
		try {
			Crashlytics.log('user open shift');
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

			if (!isObject(workLog) || isEmptyObject(workLog)) return null;

			const {referenceId, name, type, suggestedTime = 0} = workLog;
			const shiftId = Storage.getString(SHIFT_ID);
			const startTime = new Date();
			const workLogId = generateRandomId();

			await ShiftWorklogs.open({
				referenceId,
				startDate: startTime.toISOString(),
			});

			const dataForTimeTracker = {
				type,
				name,
				shiftId,
				referenceId,
			};

			await this._startTracking({
				id: workLogId,
				date: startTime.toISOString(),
				payload: dataForTimeTracker,
			});

			const suggestedFinishDate = new Date(
				startTime.getTime() + suggestedTime * 60 * 1000
			).toISOString();

			const dataForStorage = {
				...dataForTimeTracker,
				suggestedFinishDate,
				suggestedTime,
			};

			Storage.set(SHIFT_STATUS, 'paused');
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
			if (!isObject(workLog) || isEmptyObject(workLog)) return null;

			const {referenceId, name, type} = workLog;
			const shiftId = Storage.getString(SHIFT_ID);
			const endTime = new Date().toISOString();
			const workLogId = Storage.getString(CURRENT_WORKLOG_ID);

			await ShiftWorklogs.finish({
				referenceId,
				endDate: endTime,
			});

			const dataForTimeTracker = {
				type,
				name,
				shiftId,
				referenceId,
			};

			await this._finishTracking({
				id: workLogId,
				date: endTime,
				payload: dataForTimeTracker,
			});

			Storage.set(SHIFT_STATUS, 'opened');
			Storage.delete(CURRENT_WORKLOG_ID);
			Storage.delete(CURRENT_WORKLOG_DATA);

			return workLogId;
		} catch (error) {
			Crashlytics.recordError(error, 'Error closing shift worklog');
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
	 * Gets a shift report based on the shift ID and its registered events.
	 *
	 * The report includes information about performed activities, start and end times,
	 * total elapsed time, work time and pause time.
	 *
	 * @async
	 * @function getShiftReport
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
	 * @property {number} activities[].duration - Duration of the activity in seconds or milliseconds (depending on implementation).
	 * @property {string} startDate - Start date and time of the shift.
	 * @property {string} endDate - End date and time of the shift (can be empty if not finished).
	 * @property {number} elapsedTime - Total elapsed time between shift start and end.
	 * @property {number} workTime - Effective work time (total time minus pauses).
	 * @property {number} pauseTime - Total time of registered pauses.
	 * @property {boolean} isComplete - Indicates if the report was obtained completely without errors.
	 * @property {string|null} error - Error message if the report is not complete, or null if there were no errors.
	 */

	async getShiftReport() {
		try {
			Crashlytics.log('user get shift report');
			const shiftId = Storage.getString(SHIFT_ID);

			if (!shiftId) throw new Error('Shift ID is required');

			const workLogsEvents = await ShiftWorklogs.getTrackedShiftWorkLogs(shiftId);
			const startDate = await TrackerRecords.getStartDateById(shiftId);
			const endDate = await TrackerRecords.getEndDateById(shiftId);

			const activities = Formatter.formatShiftActivities(workLogsEvents);
			const elapsedTime = TimeTracker.getElapsedTime({
				startTime: startDate,
				...(!!endDate && {endTime: endDate}),
				format: false,
			});

			const pauseTime = activities.reduce((acc, activity) => {
				if (activity?.type === 'pause') return acc + activity.duration;

				return acc;
			}, 0);
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
			Storage.clearAll();
			return await TimeTracker.deleteAllEvents();
		} catch (error) {
			Crashlytics.recordError(error, 'Error deleting registers from shift tracking database');
			return Promise.reject(error);
		}
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
}
export default new Shift();
