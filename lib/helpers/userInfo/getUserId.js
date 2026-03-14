import {getUserInfo} from '@janiscommerce/oauth-native';

const getUserId = async () => {
	try {
		const userInfo = await getUserInfo();
		return userInfo?.sub || '';
	} catch (error) {
		return '';
	}
};

export default getUserId;
