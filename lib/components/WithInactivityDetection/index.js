import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {AppState, PanResponder, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {generateRandomId} from '@janiscommerce/apps-helpers';
import Shift from '../../Shift';
import ShiftWorklogs from '../../ShiftWorklogs';
import ShiftInactivity from '../../ShiftInactivity';
import {INTERNAL_WORKLOGS} from '../../constant';
import {useShiftTracking} from '../../context/ShiftTrackingContext';

const WithInactivityDetection = (WrappedComponent) => {
	const InactivityWrapper = (props) => {
		const instanceId = useRef(`inactivity_${generateRandomId()}`).current;

		const {
			inactivityTimeout = 0,
			hasStaffAuthorization = false,
			currentWorkLogData = {referenceId: null},
			currentWorkLogId,
		} = useShiftTracking();

		const timeOut = useMemo(() => inactivityTimeout * 60 * 1000, [inactivityTimeout]);
		const inactivityIsNotConfigured = useMemo(
			() => !inactivityTimeout || !hasStaffAuthorization,
			[inactivityTimeout, hasStaffAuthorization]
		);

		const isFocusedRef = useRef(false);
		const appStateRef = useRef(AppState.currentState);
		const isInactiveRef = useRef(false);
		const shouldSkipRef = useRef(false);

		const isInactive = currentWorkLogData?.referenceId === INTERNAL_WORKLOGS.INACTIVITY.referenceId;
		const shouldSkipDetection = !!(
			ShiftWorklogs.isValidWorkLog(currentWorkLogData) && !currentWorkLogData.isInternal
		);

		isInactiveRef.current = isInactive;
		shouldSkipRef.current = shouldSkipDetection;

		const panResponder = useRef(
			PanResponder.create({
				onStartShouldSetPanResponderCapture: () => {
					if (shouldSkipRef.current || isInactiveRef.current) return;
					ShiftInactivity.resetTimer();
				},
			})
		).current;

		const startInactivityWorkLog = useCallback(() => {
			const startDate = new Date(ShiftInactivity.lastTimerResetAt + timeOut).toISOString();
			Shift.openWorkLog({...INTERNAL_WORKLOGS.INACTIVITY, startDate}).catch(
				/* istanbul ignore next */ () => {}
			);
		}, [timeOut]);

		useFocusEffect(
			useCallback(() => {
				isFocusedRef.current = true;
				if (inactivityIsNotConfigured) {
					return () => {
						isFocusedRef.current = false;
					};
				}

				if (shouldSkipRef.current || isInactiveRef.current || !timeOut) {
					return () => {
						isFocusedRef.current = false;
					};
				}

				ShiftInactivity.configureTimer(timeOut);

				const persistedAt = ShiftInactivity.lastTimerResetAt;
				const elapsedTime = persistedAt ? Date.now() - persistedAt : 0;

				if (!!elapsedTime && elapsedTime >= timeOut) {
					startInactivityWorkLog();
					return () => {
						isFocusedRef.current = false;
					};
				}

				ShiftInactivity.startTimer({
					duration: elapsedTime ? timeOut - elapsedTime : timeOut,
					onTimeout: startInactivityWorkLog,
					instanceId,
				});

				return () => {
					isFocusedRef.current = false;
					ShiftInactivity.stopTimer(instanceId);
				};
			}, [timeOut, startInactivityWorkLog, currentWorkLogId, inactivityIsNotConfigured])
		);

		useEffect(() => {
			if (inactivityIsNotConfigured || shouldSkipDetection || isInactive) {
				ShiftInactivity.stopTimer(instanceId);
			}
		}, [inactivityIsNotConfigured, shouldSkipDetection, isInactive, instanceId]);

		useEffect(() => {
			if (inactivityIsNotConfigured) return;

			const subscription = AppState.addEventListener('change', (nextAppState) => {
				if (!isFocusedRef.current || shouldSkipRef.current || isInactiveRef.current) return;

				const previousState = appStateRef.current;
				appStateRef.current = nextAppState;

				if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
					ShiftInactivity.clearTimer();
					return;
				}

				if (previousState.match(/inactive|background/) && nextAppState === 'active') {
					const elapsedTime = Date.now() - ShiftInactivity.lastTimerResetAt;

					if (elapsedTime >= timeOut) {
						startInactivityWorkLog();
					} else {
						ShiftInactivity.startTimer({
							duration: timeOut - elapsedTime,
							onTimeout: startInactivityWorkLog,
							instanceId,
						});
					}
				}
			});

			// eslint-disable-next-line consistent-return
			return () => {
				subscription.remove();
			};
		}, [startInactivityWorkLog, inactivityIsNotConfigured]);

		if (inactivityIsNotConfigured || shouldSkipDetection || isInactive) {
			return <WrappedComponent {...props} />;
		}

		return (
			<View style={{flex: 1}} {...panResponder.panHandlers}>
				<WrappedComponent {...props} />
			</View>
		);
	};

	return InactivityWrapper;
};

export default WithInactivityDetection;
