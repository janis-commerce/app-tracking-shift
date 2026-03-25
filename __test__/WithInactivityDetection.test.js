import React from 'react';
import {render} from '@testing-library/react';
import {AppState} from 'react-native';
import WithInactivityDetection from '../lib/components/WithInactivityDetection';
import ShiftTrackingContext from '../lib/context/ShiftTrackingContext';
import ShiftInactivity from '../lib/ShiftInactivity';
import ShiftWorklogs from '../lib/ShiftWorklogs';
import Shift from '../lib/Shift';
import {INTERNAL_WORKLOGS} from '../lib/constant';

const FIXED_INSTANCE_ID = 'inactivity_fixed-random-id';
const TIMEOUT_MINUTES = 5;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000; // 300000ms

jest.mock('@janiscommerce/apps-helpers', () => ({
	...jest.requireActual('@janiscommerce/apps-helpers'),
	generateRandomId: jest.fn(() => 'fixed-random-id'),
}));

jest.mock('../lib/ShiftInactivity', () => {
	const mock = {
		configureTimer: jest.fn(),
		startTimer: jest.fn(),
		clearTimer: jest.fn(),
		stopTimer: jest.fn(),
		resetTimer: jest.fn(),
	};
	Object.defineProperty(mock, 'lastTimerResetAt', {
		get: jest.fn(() => null),
		configurable: true,
	});
	return {__esModule: true, default: mock};
});

jest.mock('../lib/context/ShiftTrackingContext', () => {
	const React = require('react');
	const ShiftTrackingContextMock = React.createContext();
	return {
		__esModule: true,
		default: ShiftTrackingContextMock,
		useShiftTracking: () => React.useContext(ShiftTrackingContextMock),
	};
});

let appStateListener = null;
let focusEffectCleanup = null;
let panResponderCaptureHandler = null;

jest.mock('react-native', () => ({
	AppState: {
		currentState: 'active',
		addEventListener: jest.fn((event, handler) => {
			appStateListener = handler;
			return {remove: jest.fn()};
		}),
	},
	PanResponder: {
		create: jest.fn((config) => {
			panResponderCaptureHandler = config.onStartShouldSetPanResponderCapture;
			return {panHandlers: {}};
		}),
	},
	View: ({children, ...props}) => {
		const React = require('react');
		return React.createElement('div', {'data-testid': 'pan-responder-view', ...props}, children);
	},
}));

jest.mock('@react-navigation/native', () => ({
	useFocusEffect: jest.fn((cb) => {
		const cleanup = cb();
		if (typeof cleanup === 'function') {
			focusEffectCleanup = cleanup;
		}
	}),
}));

const TestComponent = () => <div data-testid="test-component" />;

const BASE_CONTEXT = {
	inactivityTimeout: TIMEOUT_MINUTES,
	hasStaffAuthorization: true,
	currentWorkLogData: {referenceId: null},
	currentWorkLogId: null,
};

const spyLastTimerResetAt = (value) =>
	jest.spyOn(ShiftInactivity, 'lastTimerResetAt', 'get').mockReturnValue(value);

const renderWithContext = (contextValue = BASE_CONTEXT) => {
	const WrappedComponent = WithInactivityDetection(TestComponent);
	return render(
		<ShiftTrackingContext.Provider value={contextValue}>
			<WrappedComponent />
		</ShiftTrackingContext.Provider>
	);
};

describe('WithInactivityDetection HOC', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		appStateListener = null;
		focusEffectCleanup = null;
		panResponderCaptureHandler = null;
		AppState.currentState = 'active';
		ShiftWorklogs.isValidWorkLog.mockReturnValue(false);
	});

	describe('Initial behavior', () => {
		it('should call configureTimer and startTimer with full timeout when there is no persisted lastTimerResetAt', () => {
			spyLastTimerResetAt(null);

			renderWithContext(BASE_CONTEXT);

			expect(ShiftInactivity.configureTimer).toHaveBeenCalledWith(TIMEOUT_MS);
			expect(ShiftInactivity.startTimer).toHaveBeenCalledWith(
				expect.objectContaining({
					duration: TIMEOUT_MS,
					instanceId: FIXED_INSTANCE_ID,
				})
			);
		});

		it('should render the wrapped component inside a View with panHandlers when inactivity is configured', () => {
			spyLastTimerResetAt(null);

			const {getByTestId} = renderWithContext(BASE_CONTEXT);

			expect(getByTestId('pan-responder-view')).toBeDefined();
			expect(getByTestId('test-component')).toBeDefined();
		});

		it('should not configure or start timer when inactivityTimeout is 0', () => {
			spyLastTimerResetAt(null);

			// using default values for hasStaffAuthorization, currentWorkLogData and inactivityTimeout
			renderWithContext({currentWorkLogId: 'some-worklog-id'});

			expect(ShiftInactivity.configureTimer).not.toHaveBeenCalled();
			expect(ShiftInactivity.startTimer).not.toHaveBeenCalled();
		});

		it('should not configure or start timer when hasStaffAuthorization is false', () => {
			spyLastTimerResetAt(null);

			renderWithContext({...BASE_CONTEXT, hasStaffAuthorization: false});
			expect(focusEffectCleanup).not.toBeNull();
			focusEffectCleanup();

			expect(ShiftInactivity.configureTimer).not.toHaveBeenCalled();
			expect(ShiftInactivity.startTimer).not.toHaveBeenCalled();
		});
	});

	describe('Behavior with persisted lastTimerResetAt', () => {
		it('should call startTimer with remaining duration when elapsed time is less than timeout', () => {
			const elapsedTime = 60 * 1000; // 1 minute elapsed
			const now = Date.now();
			const persistedAt = now - elapsedTime;
			const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

			spyLastTimerResetAt(persistedAt);

			renderWithContext(BASE_CONTEXT);

			expect(ShiftInactivity.configureTimer).toHaveBeenCalledWith(TIMEOUT_MS);
			expect(ShiftInactivity.startTimer).toHaveBeenCalledWith(
				expect.objectContaining({
					duration: TIMEOUT_MS - elapsedTime,
					instanceId: FIXED_INSTANCE_ID,
				})
			);

			dateSpy.mockRestore();
		});
	});

	describe('Focus behavior when timeout expired at mount time', () => {
		it('should call openWorkLog immediately on focus when persisted lastTimerResetAt is already expired', () => {
			const openWorkLogSpy = jest.spyOn(Shift, 'openWorkLog').mockResolvedValue('worklog-id');
			const now = Date.now();
			const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

			spyLastTimerResetAt(now - TIMEOUT_MS - 1000); // expired 1 second ago

			renderWithContext(BASE_CONTEXT);
			expect(focusEffectCleanup).not.toBeNull();
			focusEffectCleanup();

			expect(openWorkLogSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					referenceId: INTERNAL_WORKLOGS.INACTIVITY.referenceId,
				})
			);
			expect(ShiftInactivity.startTimer).not.toHaveBeenCalled();

			dateSpy.mockRestore();
			openWorkLogSpy.mockRestore();
		});
	});

	describe('Going to background', () => {
		it('should call clearTimer when app goes from active to background', () => {
			spyLastTimerResetAt(null);

			renderWithContext(BASE_CONTEXT);

			expect(appStateListener).not.toBeNull();
			appStateListener('background');

			expect(ShiftInactivity.clearTimer).toHaveBeenCalled();
		});

		it('should call clearTimer when app goes from active to inactive', () => {
			spyLastTimerResetAt(null);

			renderWithContext(BASE_CONTEXT);

			appStateListener('inactive');

			expect(ShiftInactivity.clearTimer).toHaveBeenCalled();
		});

		it('should not process appState change when component is not focused', () => {
			spyLastTimerResetAt(null);

			renderWithContext(BASE_CONTEXT);

			expect(focusEffectCleanup).not.toBeNull();
			focusEffectCleanup();

			jest.clearAllMocks();

			appStateListener('background');

			expect(ShiftInactivity.clearTimer).not.toHaveBeenCalled();
		});
	});

	describe('Returning to foreground with active timeout', () => {
		it('should call startTimer with remaining duration when returning to foreground and timeout has not expired', () => {
			const elapsedTime = 60 * 1000; // 1 minute elapsed
			const now = Date.now();
			const persistedAt = now - elapsedTime;
			const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

			spyLastTimerResetAt(persistedAt);

			renderWithContext(BASE_CONTEXT);

			appStateListener('background');
			appStateListener('active');

			expect(ShiftInactivity.startTimer).toHaveBeenLastCalledWith(
				expect.objectContaining({
					duration: TIMEOUT_MS - elapsedTime,
					instanceId: FIXED_INSTANCE_ID,
				})
			);

			dateSpy.mockRestore();
		});
	});

	describe('Returning to foreground with expired timeout', () => {
		it('should call Shift.openWorkLog with inactivity worklog when timeout has expired on foreground return', () => {
			const openWorkLogSpy = jest.spyOn(Shift, 'openWorkLog').mockResolvedValue('worklog-id');
			const now = Date.now();
			const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

			spyLastTimerResetAt(now - TIMEOUT_MS - 5000); // expired 5 seconds ago

			renderWithContext(BASE_CONTEXT);

			appStateListener('background');
			appStateListener('active');

			expect(openWorkLogSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					referenceId: INTERNAL_WORKLOGS.INACTIVITY.referenceId,
					type: INTERNAL_WORKLOGS.INACTIVITY.type,
					name: INTERNAL_WORKLOGS.INACTIVITY.name,
					isInternal: true,
				})
			);

			dateSpy.mockRestore();
			openWorkLogSpy.mockRestore();
		});
	});

	describe('With active worklog in progress', () => {
		it('should call stopTimer and render without the PanResponder View when currentWorkLogData is a valid non-internal worklog', () => {
			ShiftWorklogs.isValidWorkLog.mockReturnValue(true);
			spyLastTimerResetAt(null);

			const {queryByTestId, getByTestId} = renderWithContext({
				...BASE_CONTEXT,
				currentWorkLogData: {referenceId: 'some-external-worklog', isInternal: false},
			});
			expect(focusEffectCleanup).not.toBeNull();
			focusEffectCleanup();

			expect(ShiftInactivity.stopTimer).toHaveBeenCalled();
			expect(queryByTestId('pan-responder-view')).toBeNull();
			expect(getByTestId('test-component')).toBeDefined();
		});

		it('should not start the timer when a valid non-internal worklog is in progress', () => {
			ShiftWorklogs.isValidWorkLog.mockReturnValue(true);
			spyLastTimerResetAt(null);

			renderWithContext({
				...BASE_CONTEXT,
				currentWorkLogData: {referenceId: 'some-external-worklog', isInternal: false},
			});

			expect(ShiftInactivity.startTimer).not.toHaveBeenCalled();
		});
	});

	describe('With inactivity worklog in progress', () => {
		it('should call stopTimer and render without the PanResponder View when the inactivity worklog is active', () => {
			ShiftWorklogs.isValidWorkLog.mockReturnValue(false);
			spyLastTimerResetAt(null);

			const {queryByTestId, getByTestId} = renderWithContext({
				...BASE_CONTEXT,
				currentWorkLogData: {
					referenceId: INTERNAL_WORKLOGS.INACTIVITY.referenceId,
					isInternal: true,
				},
			});

			expect(ShiftInactivity.stopTimer).toHaveBeenCalled();
			expect(queryByTestId('pan-responder-view')).toBeNull();
			expect(getByTestId('test-component')).toBeDefined();
		});

		it('should not start the timer when the inactivity worklog is active', () => {
			ShiftWorklogs.isValidWorkLog.mockReturnValue(false);
			spyLastTimerResetAt(null);

			renderWithContext({
				...BASE_CONTEXT,
				currentWorkLogData: {
					referenceId: INTERNAL_WORKLOGS.INACTIVITY.referenceId,
					isInternal: true,
				},
			});

			expect(ShiftInactivity.startTimer).not.toHaveBeenCalled();
		});
	});

	describe('Cleanup on blur/unmount', () => {
		it('should call stopTimer with instanceId when focus is lost', () => {
			spyLastTimerResetAt(null);

			renderWithContext(BASE_CONTEXT);

			expect(focusEffectCleanup).not.toBeNull();
			focusEffectCleanup();

			expect(ShiftInactivity.stopTimer).toHaveBeenCalledWith(FIXED_INSTANCE_ID);
		});
	});

	describe('PanResponder touch detection', () => {
		it('should call resetTimer when user touches the screen and no worklog is active', () => {
			spyLastTimerResetAt(null);

			renderWithContext(BASE_CONTEXT);

			expect(panResponderCaptureHandler).not.toBeNull();
			panResponderCaptureHandler();

			expect(ShiftInactivity.resetTimer).toHaveBeenCalled();
		});

		it('should not call resetTimer when a valid non-internal worklog is in progress', () => {
			ShiftWorklogs.isValidWorkLog.mockReturnValue(true);
			spyLastTimerResetAt(null);

			renderWithContext({
				...BASE_CONTEXT,
				currentWorkLogData: {referenceId: 'some-external-worklog', isInternal: false},
			});

			expect(panResponderCaptureHandler).not.toBeNull();
			panResponderCaptureHandler();

			expect(ShiftInactivity.resetTimer).not.toHaveBeenCalled();
		});

		it('should not call resetTimer when the inactivity worklog is active', () => {
			ShiftWorklogs.isValidWorkLog.mockReturnValue(false);
			spyLastTimerResetAt(null);

			renderWithContext({
				...BASE_CONTEXT,
				currentWorkLogData: {
					referenceId: INTERNAL_WORKLOGS.INACTIVITY.referenceId,
					isInternal: true,
				},
			});

			expect(panResponderCaptureHandler).not.toBeNull();
			panResponderCaptureHandler();

			expect(ShiftInactivity.resetTimer).not.toHaveBeenCalled();
		});
	});
});
