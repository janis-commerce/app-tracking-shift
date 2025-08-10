import TimeTracker from './db/TimeTrackerService';
import StaffService from './StaffApiServices';
import Storage from './db/StorageService';
import Crashlytics from './utils/crashlytics';
import ShiftWorklogs from './ShiftWorklogs';
import {generateRandomId} from './utils/helpers';
import {
	SHIFT_ID,
	SHIFT_STATUS,
	SHIFT_DATA,
	CURRENT_WORKLOG_DATA,
	CURRENT_WORKLOG_ID,
} from './constant';
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
	 * Pause the shift in the staff MS and record this event in the time tracking database.
	 * @throws {Error} error
	 * @returns {Promise<null>} null => if the shift was paused successfully
	 */

	pause() {
		try {
			Crashlytics.log('user pause shift');
			Storage.set(SHIFT_STATUS, 'paused');
			return null;
		} catch (error) {
			Crashlytics.recordError(error, 'Error pausing shift');
			return Promise.reject(error);
		}
	}

	/**
	 * Resume the shift in the staff MS and record this event in the time tracking database.
	 * @throws {Error} error
	 * @returns {Promise<null>} null => if the shift was resumed successfully
	 */

	resume() {
		try {
			Crashlytics.log('user resume shift');
			Storage.set(SHIFT_STATUS, 'opened');
			return null;
		} catch (error) {
			Crashlytics.recordError(error, 'Error resuming shift');
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

			await this._finishTracking({id: shiftId, date});

			Storage.set(SHIFT_STATUS, 'closed');
			Storage.delete(SHIFT_ID);

			return shiftId;
		} catch (error) {
			Crashlytics.recordError(error, 'Error closing shift in staff service');
			return Promise.reject(error);
		}
	}

	async openWorkLog(params = {}) {
		try {
			Crashlytics.log('user open shift worklog');
			const {referenceId, name, type, suggestedTime} = params;
			const shiftId = Storage.getString(SHIFT_ID);
			const startTime = new Date();
			const workLogId = generateRandomId();

			await ShiftWorklogs.open({
				referenceId,
				startDate: startTime.toISOString(),
			});

			const workLogData = {
				type,
				name,
				shiftId,
				referenceId,
			};

			await this._startTracking({
				id: workLogId,
				date: startTime.toISOString(),
				payload: workLogData,
			});

			const suggestedFinishDate = new Date(
				startTime.getTime() + suggestedTime * 60 * 1000
			).toISOString();

			Storage.set(CURRENT_WORKLOG_ID, workLogId);
			Storage.set(
				CURRENT_WORKLOG_DATA,
				JSON.stringify({...workLogData, suggestedFinishDate, suggestedTime})
			);

			return workLogId;
		} catch (error) {
			Crashlytics.recordError(error, 'Error opening shift worklog');
			return Promise.reject(error);
		}
	}

	async finishWorkLog(params = {}) {
		try {
			Crashlytics.log('user close shift worklog');
			const {referenceId, name, type} = params;
			const shiftId = Storage.getString(SHIFT_ID);
			const endTime = new Date().toISOString();
			const workLogId = Storage.getString(CURRENT_WORKLOG_ID);

			await ShiftWorklogs.finish({
				referenceId,
				endDate: endTime,
			});

			const workLogData = {
				type,
				name,
				shiftId,
				referenceId,
			};

			await this._finishTracking({
				id: workLogId,
				date: endTime,
				payload: workLogData,
			});

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
					...(id && {id}),
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
	 * Fetch the work log types from the staff MS and prepare them for register an activity.
	 * @throws {Error} error
	 * @returns {Promise<Array>} workLogTypes => Array of work log types
	 */

	async fetchWorklogTypes() {
		try {
			Crashlytics.log('user fetch worklog types');
			const {result: workLogTypes = []} = await StaffService.getWorkLogTypes();

			return ShiftWorklogs.prepareWorkLogTypes(workLogTypes);
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
