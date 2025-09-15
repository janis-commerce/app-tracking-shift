import {useMMKVString} from 'react-native-mmkv';
import {useMemo} from 'react';
import Crashlytics from '../../utils/crashlytics';
import errorParser from '../../utils/errorParser';

export const useMMKVObject = (key, defaultValue = null) => {
	const [raw] = useMMKVString(key);

	const storageValue = useMemo(() => {
		if (!raw) return defaultValue;
		try {
			return JSON.parse(raw);
		} catch (e) {
			const parsedError = errorParser(e);
			Crashlytics.recordError(parsedError, `Invalid JSON in MMKV key: ${key}`);
			return defaultValue;
		}
	}, [raw]);

	return [storageValue];
};
