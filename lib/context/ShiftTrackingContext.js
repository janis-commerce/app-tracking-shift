import React from 'react';

const ShiftTrackingContext = React.createContext();

export const useShiftTracking = () => React.useContext(ShiftTrackingContext);

export default ShiftTrackingContext;
