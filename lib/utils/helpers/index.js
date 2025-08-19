export const generateRandomId = () => Math.random().toString(32).slice(2);

export const isFunction = (fn) => !!({}.toString.call(fn) === '[object Function]');

export const isObject = (obj) => !!(obj && obj.constructor === Object);

export const isEmptyObject = (obj) => isObject(obj) && !Object.keys(obj).length;

export const promiseWrapper = (promise) =>
	promise.then((data) => [data, null]).catch((error) => Promise.resolve([null, error]));

export const isArray = (arr) => Array.isArray(arr);

export const isEmptyArray = (arr) => isArray(arr) && !arr.length;

export const isValidObject = (obj) => isObject(obj) && !!Object.keys(obj).length;
