import {OFFLINE_DATA} from './constant';
import Storage from './db/StorageService';
import {isArray, isEmptyArray} from './utils/helpers';

class OfflineData {
	get hasData() {
		const offlineData = Storage.get(OFFLINE_DATA) || [];
		return offlineData.length > 0;
	}

	/**
	 * Saves data to the offline data storage.
	 *
	 * @param {string} id - The reference id of the data.
	 * @param {Object} data - The data to save.
	 */

	save(id, data) {
		try {
			const offlineData = Storage.get(OFFLINE_DATA) || [];
			console.log('offlineData save', offlineData);
			const foundIdx = offlineData.findIndex((item) => item.storageId === id);
			console.log('foundIdx', foundIdx);
			if (foundIdx === -1) {
				offlineData.push({storageId: id, ...data});
			} else {
				const storedData = offlineData[foundIdx];
				offlineData[foundIdx] = {...storedData, ...data};
			}

			console.log('offlineData saved', offlineData);
			Storage.set(OFFLINE_DATA, offlineData);
		} catch (error) {
			throw new Error(error);
		}
	}

	/**
	 * Gets data from the offline data storage.
	 *
	 * @param {string | Array<string> | null} id - The ID of the storage to get the data from.
	 * @returns {Array<Object>} The data from the storage.
	 */

	get(id = null) {
		try {
			const offlineData = Storage.get(OFFLINE_DATA) || [];
			console.log('offlineData get', offlineData);

			if (!isArray(id)) {
				id = [id].filter(Boolean);
			}

			if (isEmptyArray(id)) return offlineData;

			return offlineData.filter((item) => id.includes(item.storageId));
		} catch (error) {
			throw new Error(error);
		}
	}

	/**
	 * Deletes data from the offline data storage.
	 *
	 * @param {string | Array<string>} id - The reference id of the data.
	 */

	delete(id) {
		try {
			const offlineData = Storage.get(OFFLINE_DATA) || [];

			if (!isArray(id)) {
				id = [id].filter(Boolean);
			}

			if (isEmptyArray(id)) return;

			const filteredData = offlineData.filter((item) => !id.includes(item.storageId));

			Storage.set(OFFLINE_DATA, filteredData);
		} catch (error) {
			throw new Error(error);
		}
	}

	/**
	 * Deletes all data from the offline data storage.
	 */

	deleteAll() {
		try {
			Storage.remove(OFFLINE_DATA);
		} catch (error) {
			throw new Error(error);
		}
	}
}

export default new OfflineData();
