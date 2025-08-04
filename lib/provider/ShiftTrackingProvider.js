import React, {useEffect} from 'react';
import ShiftTrackingContext from '../context/ShiftTrackingContext';
import ShiftClass from '../Shift';
import Crashlytics from '../utils/crashlytics';

const ShiftTrackingProvider = ({children, environment, onOpenShiftError = null}) => {
	const Shift = new ShiftClass({environment});

	const openShift = async () => {
		Crashlytics.log('open shift by provider');
		try {
			await Shift.open();
		} catch (error) {
			Crashlytics.recordError(error, 'Error opening shift in staff service');
			if (onOpenShiftError) onOpenShiftError(error);
		}
	};

	useEffect(() => {
		openShift();
	}, []);

	return <ShiftTrackingContext.Provider>{children}</ShiftTrackingContext.Provider>;
};

export default ShiftTrackingProvider;
