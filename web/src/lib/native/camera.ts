import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { isNativePlatform } from './platform';

/**
 * 将 base64 转换为 Blob
 */
function base64ToBlob(base64: string, mime: string): Blob {
  const byteChars = atob(base64);
  const byteArrays: number[] = [];
  for (let i = 0; i < byteChars.length; i++) {
    byteArrays.push(byteChars.charCodeAt(i));
  }
  return new Blob([new Uint8Array(byteArrays)], { type: mime });
}

/**
 * 使用原生相机拍照
 * 仅在原生平台可用
 */
export async function takePhoto(): Promise<File | null> {
  if (!isNativePlatform()) {
    return null;
  }

  try {
    const photo: Photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      saveToGallery: false,
      correctOrientation: true
    });

    if (!photo.base64String) {
      return null;
    }

    const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = base64ToBlob(photo.base64String, mimeType);
    const fileName = `receipt_${Date.now()}.${photo.format || 'jpg'}`;

    return new File([blob], fileName, { type: mimeType });
  } catch (error) {
    console.error('Camera error:', error);
    return null;
  }
}

/**
 * 从相册选择图片
 * 仅在原生平台可用
 */
export async function pickImage(): Promise<File | null> {
  if (!isNativePlatform()) {
    return null;
  }

  try {
    const photo: Photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      correctOrientation: true
    });

    if (!photo.base64String) {
      return null;
    }

    const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = base64ToBlob(photo.base64String, mimeType);
    const fileName = `receipt_${Date.now()}.${photo.format || 'jpg'}`;

    return new File([blob], fileName, { type: mimeType });
  } catch (error) {
    console.error('Pick image error:', error);
    return null;
  }
}

/**
 * 检查相机权限
 */
export async function checkCameraPermission(): Promise<boolean> {
  if (!isNativePlatform()) {
    return true;
  }

  try {
    const permission = await Camera.checkPermissions();
    return permission.camera === 'granted';
  } catch {
    return false;
  }
}

/**
 * 请求相机权限
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (!isNativePlatform()) {
    return true;
  }

  try {
    const permission = await Camera.requestPermissions({ permissions: ['camera'] });
    return permission.camera === 'granted';
  } catch {
    return false;
  }
}
