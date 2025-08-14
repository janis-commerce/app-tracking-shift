import TimeTracker from './db/TimeTrackerService';
import {reverseArray} from './utils/helpers';

class TrackerRecords {
	async getWorkLogsFromTimeTracker(filteredId) {
		try {
			if (!filteredId) throw new Error(`Excluding ID is required, but got ${filteredId}`);

			const events = await this._filterEventsExcludingId(filteredId);

			return events;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async getClientShiftActivities(id) {
		try {
			const query = 'NOT (id CONTAINS[c] "picking" OR id CONTAINS[c] "delivery") AND id != $0';
			const clientActivities = await TimeTracker.searchEventByQuery(query, id);

			return clientActivities;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async getStartDateById(id) {
		try {
			if (!id) throw new Error(`ID is required, but got ${id}`);

			const startShiftEvent = await this._getStartEventById(id);

			return startShiftEvent?.time;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async getEndDateById(id) {
		try {
			if (!id) throw new Error(`ID is required, but got ${id}`);

			const endShiftEvent = await this._getFinishEventById(id);

			return endShiftEvent?.time;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async _getStartEventById(id) {
		try {
			const startEvent = await this._filterEventByType(id, 'start');

			const [firstEvent = {}] = startEvent;

			return firstEvent;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async _getFinishEventById(id) {
		try {
			const finishEvent = await this._filterEventByType(id, 'finish');

			const [lastEvent = {}] = reverseArray(finishEvent);

			return lastEvent;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async _filterEventByType(id, type) {
		try {
			if (!id) throw new Error('id is required');
			if (!type) throw new Error('type is required');

			const events = await TimeTracker.searchEventByQuery('id == $0 AND type == $1', id, type);
			console.log('events', events);

			return events;
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async _filterEventsExcludingId(id) {
		try {
			if (!id) throw new Error('id is required');

			const events = await TimeTracker.searchEventByQuery('id!= $0', id);

			return events;
		} catch (error) {
			return Promise.reject(error);
		}
	}
}

export default new TrackerRecords();
