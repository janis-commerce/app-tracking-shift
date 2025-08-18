import React from 'react';
import {useShiftTracking} from '../../context/ShiftTrackingContext';

/**
 * @param {React.Component} WrappedComponent - The component to wrap
 * @param {Object} options - The options for the component
 * @param {React.Component} options.pausedShiftComponent - The component to render when the shift is paused
 * @returns {React.Component} - The wrapped component
 *
 * @example
 * const MyComponent = () => {
 *   return <div>My Component</div>;
 * };
 *
 * export default WithShiftTracking(MyComponent, {
 *   pausedShiftComponent: <div>Paused Shift</div>,
 * });
 */

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
