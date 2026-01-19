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

  // Check if it's likely an image (by extension or type)
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
  const isImage = file.type.startsWith('image/') || imageExtensions.includes(ext);

  if (!isImage) {
    console.warn('Not an image file, skipping compression:', file.type, file.name);
    return file;
  }

  console.log('Starting compression for:', file.name, 'size:', (file.size / 1024 / 1024).toFixed(2) + 'MB', 'type:', file.type);

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      try {
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.warn('Could not get canvas context, returning original file');
          resolve(file);
          return;
        }

        // Calculate new dimensions (reduce size proportionally)
        let { width, height } = img;
        const maxDimension = 1600; // Reduced from 2048 for better compression

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
        ctx.drawImage(img, 0, 0, width, height);

        // Try different quality levels to get under 5MB
        const qualities = [0.7, 0.5, 0.3, 0.2, 0.1];

        for (const quality of qualities) {
          const blob = await new Promise<Blob | null>((res) => {
            canvas.toBlob(res, 'image/jpeg', quality);
          });

          if (blob && blob.size <= MAX_SIZE) {
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            console.log(`Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(blob.size / 1024 / 1024).toFixed(2)}MB (quality: ${quality})`);
            resolve(compressedFile);
            return;
          }
        }

        // If still too large, reduce dimensions further
        const smallerCanvas = document.createElement('canvas');
        const smallerCtx = smallerCanvas.getContext('2d');
        if (smallerCtx) {
          smallerCanvas.width = Math.round(width * 0.5);
          smallerCanvas.height = Math.round(height * 0.5);
          smallerCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);

          const finalBlob = await new Promise<Blob | null>((res) => {
            smallerCanvas.toBlob(res, 'image/jpeg', 0.6);
          });

          if (finalBlob && finalBlob.size <= MAX_SIZE) {
            const compressedFile = new File([finalBlob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            console.log(`Compressed (smaller): ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(finalBlob.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(compressedFile);
            return;
          }
        }

        // Last resort: return whatever we can get
        const lastBlob = await new Promise<Blob | null>((res) => {
          canvas.toBlob(res, 'image/jpeg', 0.1);
        });

        if (lastBlob) {
          const compressedFile = new File([lastBlob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          console.warn(`Compression may not be enough: ${(lastBlob.size / 1024 / 1024).toFixed(2)}MB`);
          resolve(compressedFile);
        } else {
          console.warn('Compression failed, returning original file');
          resolve(file);
        }
      } catch (err) {
        console.error('Compression error:', err);
        resolve(file); // Return original file on error instead of rejecting
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      console.warn('Failed to load image for compression, returning original');
      resolve(file); // Return original file instead of rejecting
    };

    img.src = objectUrl;
  });
}
