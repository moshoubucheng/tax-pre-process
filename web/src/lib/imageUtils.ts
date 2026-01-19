const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Compress image if it exceeds 5MB
 * Uses canvas to resize and reduce quality
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  // Only compress if file is larger than 5MB
  if (file.size <= MAX_SIZE) {
    return file;
  }

  // Only compress image files
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = async () => {
      // Calculate new dimensions (reduce size proportionally)
      let { width, height } = img;
      const maxDimension = 2048; // Max width or height

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      // Try different quality levels to get under 5MB
      const qualities = [0.8, 0.6, 0.4, 0.3, 0.2];

      for (const quality of qualities) {
        const blob = await new Promise<Blob | null>((res) => {
          canvas.toBlob(res, 'image/jpeg', quality);
        });

        if (blob && blob.size <= MAX_SIZE) {
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
          return;
        }
      }

      // If still too large, reduce dimensions further
      const smallerCanvas = document.createElement('canvas');
      const smallerCtx = smallerCanvas.getContext('2d');
      smallerCanvas.width = Math.round(width * 0.5);
      smallerCanvas.height = Math.round(height * 0.5);
      smallerCtx?.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);

      const finalBlob = await new Promise<Blob | null>((res) => {
        smallerCanvas.toBlob(res, 'image/jpeg', 0.7);
      });

      if (finalBlob) {
        const compressedFile = new File([finalBlob], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve(compressedFile);
      } else {
        reject(new Error('Failed to compress image'));
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
