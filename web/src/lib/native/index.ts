// 平台检测
export {
  isNativePlatform,
  getPlatform,
  isIOS,
  isAndroid,
  isWeb
} from './platform';

// 相机功能
export {
  takePhoto,
  pickImage,
  checkCameraPermission,
  requestCameraPermission
} from './camera';

// 存储功能
export {
  storage,
  getToken,
  setToken,
  removeToken
} from './storage';

// 网络功能
export {
  getNetworkStatus,
  isConnected,
  onNetworkStatusChange
} from './network';
