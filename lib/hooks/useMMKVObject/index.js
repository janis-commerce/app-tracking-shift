import {useMMKVString} from 'react-native-mmkv';
import {useMemo} from 'react';
import Crashlytics from '../../utils/crashlytics';

export const useMMKVObject = (key, defaultValue = null) => {
	const [raw] = useMMKVString(key);

	const storageValue = useMemo(() => {
		if (!raw) return defaultValue;
		try {
			return JSON.parse(raw);
		} catch (e) {
			Crashlytics.recordError(e, `Invalid JSON in MMKV key: ${key}`);
			return defaultValue;
		}
	}, [raw]);

	return [storageValue];
};
