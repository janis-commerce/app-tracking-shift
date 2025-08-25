import {isArray, isEmptyArray, isNumber} from './utils/helpers';
import {INTERNAL_WORKLOGS} from './constant';

class Formatter {
	/**
	 * Formats shift activities by pairing start and finish events and calculating durations.
	 *
	 * Processes an array of shift activity events to create structured activity objects
	 * with paired start/finish events and calculated durations.
	 *
	 * @param {Array<{
	 * type: string,
	 * id: string,
	 * time: string,
	 * payload: object}>} shiftActivities - Array of shift activity events with start/finish types
	 * @returns {Array<{
	 *   id: string,
	 *   name: string,
	 *   type: string,
	 *   startDate: string,
	 *   endDate?: string,
	 *   duration: number
	 * }>} Array of formatted activity objects.
	 *
	 * @property {string} id - Unique identifier for the activity
	 * @property {string} name - Activity name extracted from event payload
	 * @property {string} type - Activity type extracted from event payload (e.g., 'work', 'pause')
	 * @property {string} startDate - ISO timestamp when the activity started
	 * @property {string} [endDate] - ISO timestamp when the activity ended (optional, only if finish event exists)
	 * @property {number} duration - Duration of the activity in milliseconds (0 if no finish event)
	 */
	static formatShiftActivities(shiftActivities) {
		if (!isArray(shiftActivities) || isEmptyArray(shiftActivities)) return [];

		const parsedActivities = shiftActivities.reduce((acc, activity, index, activities) => {
			const {type, time, id, payload} = activity || {};

			if (type !== 'start') return acc;

			// Buscamos el evento 'finish' correspondiente
			const finishEvent = activities.find(
				(event, eventIndex) => eventIndex > index && event.type === 'finish' && event.id === id
			);

			let parsedActivity = {
				id,
				name: payload?.name,
				type: payload?.type,
				startDate: time,
				duration: 0,
			};

			if (finishEvent) {
				const startTime = new Date(time);
				const finishTime = new Date(finishEvent?.time);
				const duration = finishTime.getTime() - startTime.getTime();

				parsedActivity = {
					...parsedActivity,
					endDate: finishEvent.time,
					...(isNumber(duration) && {duration}),
				};
			}

			acc.push(parsedActivity);

			return acc;
		}, []);

		return parsedActivities;
	}

	/**
	 * Formats work log types by filtering and standardizing the data structure.
	 *
	 * Processes an array of work log type objects from the API to create standardized
	 * work log type objects with consistent structure and default values.
	 *
	 * @param {Array<Object>} workLogTypes - Array of work log type objects from API
	 * @returns {Array<{
	 *   id: string,
	 *   referenceId: string,
	 *   name: string,
	 *   type: string,
	 *   description: string,
	 *   suggestedTime: number
	 * }>} Array of formatted work log type objects.
	 *
	 * @property {string} id - Unique identifier for the work log type
	 * @property {string} referenceId - Reference identifier used for API operations
	 * @property {string} name - Display name of the work log type
	 * @property {string} type - Type classification of the work log (defaults to empty string)
	 * @property {string} description - Description of the work log type (defaults to empty string)
	 * @property {number} suggestedTime - Suggested duration in minutes (defaults to 0)
	 */
	static formatWorkLogTypes(workLogTypes = []) {
		if (!isArray(workLogTypes) || isEmptyArray(workLogTypes)) return [];

		const formattedWorkLogTypes = workLogTypes.map((workType) => {
			const {
				id,
				referenceId,
				name,
				description = '',
				type = '',
				suggestedTime = 0,
			} = workType || {};

			if (!id || !referenceId) return undefined;

			return {
				id,
				referenceId,
				name,
				type,
				description,
				suggestedTime,
			};
		});

		return formattedWorkLogTypes.filter(Boolean);
	}

	static formatWorkLogId(workLog, id) {
		const workLogMapper = {
			[INTERNAL_WORKLOGS.PICKING_WORK.referenceId]: `picking-${id}`,
			[INTERNAL_WORKLOGS.DELIVERY_WORK.referenceId]: `delivery-${id}`,
			default: id,
		};

		return workLogMapper[workLog] || workLogMapper.default;
	}

	/**
	 * Formats offline work logs for sending to the server.
	 *
	 * @param {Array<Object>} offlineWorkLog - Array of offline work log objects
	 * @returns {Array<{
	 *   workLogTypeRefId: string,
	 *   startDate: string,
	 *   endDate: string
	 * }>} Array of formatted work log objects for sending to the server.
	 *
	 * @property {string} workLogTypeRefId - Reference identifier for the work log type
	 * @property {string | null} startDate - ISO timestamp when the work log started
	 * @property {string | null} endDate - ISO timestamp when the work log ended
	 */
	static formatOfflineWorkLog(offlineWorkLog = []) {
		if (!isArray(offlineWorkLog)) {
			offlineWorkLog = [offlineWorkLog];
		}

		return offlineWorkLog
			.map((workLog) => {
				const {referenceId, startDate, endDate} = workLog || {};

				if (!referenceId) return null;

				return {
					workLogTypeRefId: referenceId,
					...(startDate && {startDate}),
					...(endDate && {endDate}),
				};
			})
			.filter(Boolean);
	}
}

export default Formatter;
