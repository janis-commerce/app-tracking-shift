import React, {useEffect, useMemo, useState} from 'react';
import {isFunction, promiseWrapper} from '@janiscommerce/apps-helpers';
import {useStorageValue} from '../hooks/useStorageValue';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import {downloadWorkLogTypes} from './helpers';
import {
	CURRENT_WORKLOG_DATA,
	CURRENT_WORKLOG_ID,
	SHIFT_DATA,
	SHIFT_ID,
	SHIFT_STATUS,
	STAFF_SETTINGS,
	WORKLOG_TYPES_DATA,
} from '../constant';
import Shift from '../Shift';

/**
 * ShiftTrackingProvider component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @param {Object} props.additionalInfo - Additional information for shift tracking
 * @param {string} props.additionalInfo.warehouseId - Warehouse ID to associate with the shift
 * @param {Function} props.onError - Error callback handler
 */
const ShiftTrackingProvider = ({children, additionalInfo = {}, onError = null}) => {
	const shiftStatus = useStorageValue(SHIFT_STATUS);
	const shiftId = useStorageValue(SHIFT_ID);
	const shiftData = useStorageValue(SHIFT_DATA, {});
	const currentWorkLogId = useStorageValue(CURRENT_WORKLOG_ID);
	const workLogData = useStorageValue(WORKLOG_TYPES_DATA, {});
	const currentWorkLogData = useStorageValue(CURRENT_WORKLOG_DATA, {});
	const {settings} = useStorageValue(STAFF_SETTINGS, {});

	const [error, setError] = useState(null);
	const [openShiftResult, setOpenShiftResult] = useState({
		id: null,
		getWorkLogs: false,
	});
	const [isShiftLoading, setIsShiftLoading] = useState(false);
	const [isShiftInitializationDone, setIsShiftInitializationDone] = useState(false);

	const {workLogTypes = []} = workLogData;
	const {enabledShiftAndWorkLog: hasStaffAuthorization = false, inactivityTimeout = 0} =
		settings || {};
	const {warehouseId = ''} = additionalInfo;

	const contextValues = useMemo(() => {
		return {
			shiftId,
			shiftStatus,
			shiftData,
			workLogTypes,
			hasWorkTypes: !!workLogTypes?.length,
			currentWorkLogData,
			currentWorkLogId,
			hasStaffAuthorization,
			inactivityTimeout,
			error,
			isShiftLoading,
			isShiftInitializationDone,
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
		inactivityTimeout,
		isShiftLoading,
		isShiftInitializationDone,
	]);

	const shiftInitialization = async () => {
		setIsShiftLoading(true);

		try {
			const [isAuthorized, authError] = await promiseWrapper(Shift.checkStaffMSAuthorization());

			if (authError) {
				setError({
					message: authError?.message,
					type: 'staffMSAuthorization',
				});
				return;
			}

			if (!isAuthorized) return;

			const previousShiftId = Shift?.id;
			const [openedShiftId, openError] = await promiseWrapper(Shift.open({warehouseId}));

			if (openError) {
				if (isFunction(onError)) onError(openError);
				setError({
					message: openError?.message,
					type: 'openShift',
				});
				return;
			}

			const getWorkLogs = openedShiftId !== previousShiftId;

			setOpenShiftResult((prev) => ({
				...prev,
				id: openedShiftId,
				getWorkLogs,
			}));

			const [, downloadError] = await promiseWrapper(downloadWorkLogTypes(onError));

			if (downloadError) {
				setError({
					message: downloadError?.message,
					type: 'downloadWorkLogTypes',
				});
			}
		} finally {
			setIsShiftLoading(false);
			setIsShiftInitializationDone(true);
		}
	};

	const refreshShiftWorkLogs = async () => {
		const [, workLogsError] = await promiseWrapper(Shift.refreshWorkLogs());

		if (workLogsError) {
			setError({
				message: workLogsError?.message,
				type: 'getWorkLogsFromJanis',
			});
			return;
		}

		setOpenShiftResult((prev) => ({
			...prev,
			getWorkLogs: false,
		}));
	};

	useEffect(() => {
		shiftInitialization();
	}, []);

	useEffect(() => {
		const handleWarehouseChange = async () => {
			if (warehouseId && Shift.isOpen) {
				try {
					await Shift.update({warehouseId});
				} catch (errorWarehouseChange) {
					setError({
						message: errorWarehouseChange?.message,
						type: 'updateShift',
					});
				}
			}
		};
		handleWarehouseChange();
	}, [warehouseId]);

	useEffect(() => {
		if (openShiftResult?.id && openShiftResult?.getWorkLogs) {
			refreshShiftWorkLogs();
		}
	}, [openShiftResult]);

	return (
		<ShiftTrackingContext.Provider value={contextValues}>{children}</ShiftTrackingContext.Provider>
	);
};

export default ShiftTrackingProvider;
