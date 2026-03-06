import {getInternetReachability} from '@janiscommerce/app-device-info';

/**
 * Check if internet connection is reachable
 * @returns {Promise<boolean>} true if internet is reachable, false otherwise
 */
const isInternetReachable = async () => {
	try {
		const isReachable = await getInternetReachability();
		return isReachable;
	} catch (error) {
		return false;
	}
};

export default isInternetReachable;
