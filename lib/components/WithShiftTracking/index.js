import React from 'react';
import {useShiftTracking} from '../../context/ShiftTrackingContext';

const WithShiftTracking = (WrappedComponent, options = {}) => {
	const {pausedShiftComponent} = options;

	return (props) => {
		const shiftTrackingData = useShiftTracking();

		if (shiftTrackingData?.shiftStatus === 'paused' && pausedShiftComponent) {
			return pausedShiftComponent;
		}

		return <WrappedComponent {...props} shiftData={shiftTrackingData} />;
	};
};

export default WithShiftTracking;
