import React, {useEffect, useMemo, useState} from 'react';
import {useMMKVString} from 'react-native-mmkv';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import {openShift, downloadWorkLogTypes, isAuthorizedToUseStaffMS} from '../utils/provider';
import {
	CURRENT_WORKLOG_DATA,
	CURRENT_WORKLOG_ID,
	SHIFT_DATA,
	SHIFT_ID,
	SHIFT_STATUS,
	STAFF_AUTH,
	WORKLOG_TYPES_DATA,
} from '../constant';
import {useMMKVObject} from '../hooks/useMMKVObject';
import {promiseWrapper} from '../utils/helpers';

const ShiftTrackingProvider = ({children, onError = null}) => {
	const [shiftStatus] = useMMKVString(SHIFT_STATUS);
	const [shiftId] = useMMKVString(SHIFT_ID);
	const [shiftData] = useMMKVObject(SHIFT_DATA, {});

	const [currentWorkLogId] = useMMKVString(CURRENT_WORKLOG_ID);
	const [workLogData] = useMMKVObject(WORKLOG_TYPES_DATA, {});
	const [currentWorkLogData] = useMMKVObject(CURRENT_WORKLOG_DATA, {});

	const [staffAuthData] = useMMKVObject(STAFF_AUTH, {});

	const [error, setError] = useState(null);

	const {workLogTypes = []} = workLogData;
	const {hasStaffAuthorization = false} = staffAuthData;

	const contextValues = useMemo(() => {
		return {
			shiftId,
			shiftStatus,
			shiftData,
			workLogTypes,
			currentWorkLogData,
			currentWorkLogId,
			hasStaffAuthorization,
			error,
		};
	}, [
		shiftId,
		shiftStatus,
		shiftData,
		workLogTypes,
		currentWorkLogData,
		currentWorkLogId,
		error,
		hasStaffAuthorization,
	]);

	const handleShiftTrackingInit = async () => {
		const [isAuthorized, authError] = await promiseWrapper(isAuthorizedToUseStaffMS());

		if (authError) {
			setError({
				message: authError?.message,
				type: 'staffMSAuthorization',
			});
			return;
		}

		if (!isAuthorized) return;

		const [, openError] = await promiseWrapper(openShift(onError));

		if (openError) {
			setError({
				message: openError?.message,
				type: 'openShift',
			});
			return;
		}

		const [, downloadError] = await promiseWrapper(downloadWorkLogTypes(onError));

		if (downloadError) {
			setError({
				message: downloadError?.message,
				type: 'downloadWorkLogTypes',
			});
		}
	};

	useEffect(() => {
		handleShiftTrackingInit();
	}, []);

	return (
		<ShiftTrackingContext.Provider value={contextValues}>{children}</ShiftTrackingContext.Provider>
	);
};

export default ShiftTrackingProvider;
