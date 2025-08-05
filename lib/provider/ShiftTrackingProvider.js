import React, {useEffect, useMemo} from 'react';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import Shift from '../Shift';
import getUserId from '../utils/userInfo/getUserId';
import Crashlytics from '../utils/crashlytics';
import Storage from '../db/StorageService';
import {getShiftData} from '../utils/storage';

const ShiftTrackingProvider = ({children, onOpenShiftError = null}) => {
	const shiftId = Storage.getString('shift.id');
	const shiftStatus = Storage.getString('shift.status');
	const shiftData = getShiftData();

	const contextValues = useMemo(() => {
		return {
			shiftId,
			shiftStatus,
			shiftData,
		};
	}, [shiftId, shiftStatus, shiftData]);

	// eslint-disable-next-line consistent-return
	const openShift = async () => {
		Crashlytics.log('open shift by provider');
		try {
			const userId = await getUserId();

			if (!userId) return await Shift.open();

			const currentShift = await Shift.getUserOpenShift({userId});

			if (currentShift?.status !== 'opened') {
				await Shift.open();
			} else {
				Storage.set('shift.id', currentShift.id);
				Storage.set('shift.status', currentShift.status);
				Storage.set('shift.data', JSON.stringify(currentShift));
			}
		} catch (error) {
			Crashlytics.recordError(error, 'Error opening shift in staff service');
			if (onOpenShiftError) return onOpenShiftError(error);
		}
	};

	useEffect(() => {
		openShift();
	}, []);

	return (
		<ShiftTrackingContext.Provider value={contextValues}>{children}</ShiftTrackingContext.Provider>
	);
};

export default ShiftTrackingProvider;
