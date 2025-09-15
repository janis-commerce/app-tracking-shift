import {OFFLINE_DATA} from './constant';
import Storage from './db/StorageService';
import {isArray, isEmptyArray} from './utils/helpers';
import {setObject, getObject} from './utils/storage';

class OfflineData {
	get hasData() {
		const offlineData = getObject(OFFLINE_DATA, []);
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
			const offlineData = getObject(OFFLINE_DATA, []);
			const foundIdx = offlineData.findIndex((item) => item.storageId === id);

			if (foundIdx === -1) {
				offlineData.push({storageId: id, ...data});
			} else {
				const storedData = offlineData[foundIdx];
				offlineData[foundIdx] = {...storedData, ...data};
			}

			setObject(OFFLINE_DATA, offlineData);
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
			const offlineData = getObject(OFFLINE_DATA, []);

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
	 * Gets the last record from the offline data storage.
	 *
	 * @returns {Object} The last record from the storage.
	 */

	getLastRecord() {
		try {
			const offlineData = this.get();
			const [lastRecord] = offlineData.slice(-1);
			return lastRecord;
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
			const offlineData = getObject(OFFLINE_DATA, {});

			if (!isArray(id)) {
				id = [id].filter(Boolean);
			}

			if (isEmptyArray(id)) return;

			const filteredData = offlineData.filter((item) => !id.includes(item.storageId));

			setObject(OFFLINE_DATA, filteredData);
		} catch (error) {
			throw new Error(error);
		}
	}

	/**
	 * Deletes all data from the offline data storage.
	 */

	deleteAll() {
		try {
			Storage.delete(OFFLINE_DATA);
		} catch (error) {
			throw new Error(error);
		}
	}
}

export default new OfflineData();
