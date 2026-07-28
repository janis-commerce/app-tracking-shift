import {useEffect, useState, useCallback, useRef} from 'react';
import Storage from '../../db/StorageService';
import {Crashlytics, errorParser} from '../../helpers';

export const useStorageValue = (key, defaultValue = null) => {
	// Callers usually pass an inline literal as default (e.g. `{}`), whose identity changes
	// on every render. Reading it from a ref keeps `readValue` — and therefore the storage
	// listener — stable, so writes are never missed while the listener is being replaced.
	const defaultValueRef = useRef(defaultValue);
	defaultValueRef.current = defaultValue;

	const readValue = useCallback(() => {
		try {
			return Storage.get(key) ?? defaultValueRef.current;
		} catch (error) {
			const parsedError = errorParser(error);
			Crashlytics.recordError(parsedError, `[useStorageValue] Error with key: ${key}`);
			return defaultValueRef.current;
		}
	}, [key]);

	const [value, setValue] = useState(readValue);

	useEffect(() => {
		const listener = Storage.db.addOnValueChangedListener((changedKey) => {
			if (changedKey === key) setValue(readValue());
		});

		// The value may have changed between the initial read and this subscription.
		setValue(readValue());

		return () => listener.remove();
	}, [key, readValue]);

	return value;
};
