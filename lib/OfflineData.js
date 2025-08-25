import {OFFLINE_DATA} from './constant';
import Storage from './db/StorageService';
import {isArray, isEmptyArray} from './utils/helpers';
import {setObject, getObject} from './utils/storage';

class OfflineData {
	get hasData() {
		const offlineData = getObject(OFFLINE_DATA, {});
		return Object.keys(offlineData).length > 0;
	}

	/**
	 * Saves data to the offline data storage.
	 *
	 * @param {string} storageId - The ID of the storage to save the data to.
	 * @param {Object} data - The data to save.
	 */

	save(storageId, data) {
		try {
			const offlineData = getObject(OFFLINE_DATA, {});
			offlineData[storageId] = {...offlineData[storageId], ...data};
			setObject(OFFLINE_DATA, offlineData);
		} catch (error) {
			throw new Error(error);
		}
	}

	/**
	 * Gets data from the offline data storage.
	 *
	 * @param {string | Array<string> | null} storageId - The ID of the storage to get the data from.
	 * @returns {Array<Object>} The data from the storage.
	 */

	get(storageId = null) {
		try {
			const offlineData = getObject(OFFLINE_DATA, {});

			if (!isArray(storageId)) {
				storageId = [storageId].filter(Boolean);
			}

			if (isEmptyArray(storageId)) return Object.values(offlineData);

			return storageId.map((id) => offlineData[id]);
		} catch (error) {
			throw new Error(error);
		}
	}

	/**
	 * Deletes data from the offline data storage.
	 *
	 * @param {string | Array<string>} storageId - The ID of the storage to delete the data from.
	 */

	delete(storageId) {
		try {
			const offlineData = getObject(OFFLINE_DATA, {});

			if (!isArray(storageId)) {
				storageId = [storageId].filter(Boolean);
			}

			if (isEmptyArray(storageId)) return;

			storageId.forEach((id) => {
				delete offlineData[id];
			});

			setObject(OFFLINE_DATA, offlineData);
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
