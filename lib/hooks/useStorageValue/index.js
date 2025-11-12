import {useEffect, useState, useCallback} from 'react';
import Storage from '../../db/StorageService';
import Crashlytics from '../../utils/crashlytics';
import errorParser from '../../utils/errorParser';

export const useStorageValue = (key, defaultValue = null) => {
	const readValue = useCallback(() => {
		try {
			return Storage.get(key) || defaultValue;
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, `[useStorageValue] Error with key: ${key}`);
			return defaultValue;
		}
	}, [key]);

	const [value, setValue] = useState(readValue);

	useEffect(() => {
		const listener = Storage.db.addOnValueChangedListener((changedKey) => {
			if (changedKey === key) {
				setValue(readValue());
			}
		});

		return () => listener.remove();
	}, [key, readValue]);

	return value;
};
