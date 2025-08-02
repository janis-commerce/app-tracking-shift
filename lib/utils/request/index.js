import Request from '@janiscommerce/app-request';
import { getApplicationName } from '@janiscommerce/app-device-info';

const getAppEnvironment = () => {
    const appName = getApplicationName();

    if(!appName) return '';

    if(appName.toLowerCase().includes('beta')) return 'janisdev';
    if(appName.toLowerCase().includes('qa')) return 'janisqa';

    return 'janis';
}

export default new Request({JANIS_ENV: getAppEnvironment()});