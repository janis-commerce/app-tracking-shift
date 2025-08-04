import {getUserInfo} from '@janiscommerce/oauth-native'

const getUserId = async () => {
    try {
        return await getUserInfo().then((user) => user?.sub || '')
    } catch (error) {
        return '';
    }
}

export default getUserId;