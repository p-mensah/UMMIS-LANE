// Cloudinary Client-side File & Image Management with 1MB Compression Constraint
// Product Environment: dnjvhtal5 | Key Name: Ummis

export const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB strictly enforced

export interface UploadResult {
  url: string;
  public_id: string;
  format?: string;
  bytes: number;
}

/**
 * Compresses an image file before uploading to guarantee it remains strictly <= 1MB.
 * Dynamically scales down dimensions and adjusts JPEG quality until the payload satisfies the limit.
 */
export async function compressImage(
  file: File,
  maxDimension = 1600,
  initialQuality = 0.85
): Promise<{ file: Blob; base64: string; compressedSize: number }> {
  // If already under 1MB and not an image, return original
  if (!file.type.startsWith('image/')) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of 1.0MB.`);
    }
    const base64 = await readFileAsBase64(file);
    return { file, base64, compressedSize: file.size };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Scale down dimensions if exceeding max dimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context not available for compression'));
        }

        // Fill white background for transparent PNG conversion to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = initialQuality;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Iteratively drop quality if base64 size exceeds 1MB
        // Base64 is ~33% larger than raw bytes, so check length * 0.75
        let estimatedBytes = Math.round((dataUrl.length * 3) / 4);
        while (estimatedBytes > MAX_FILE_SIZE_BYTES && quality > 0.3) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          estimatedBytes = Math.round((dataUrl.length * 3) / 4);
        }

        if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
          // If still over 1MB, resize dimensions further
          canvas.width = Math.round(width * 0.7);
          canvas.height = Math.round(height * 0.7);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          estimatedBytes = Math.round((dataUrl.length * 3) / 4);
        }

        if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
          return reject(new Error(`Unable to compress image below 1MB. Current compressed size: ${(estimatedBytes / 1024 / 1024).toFixed(2)}MB.`));
        }

        // Convert dataUrl to Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Failed to create compressed blob'));
            }
            resolve({
              file: blob,
              base64: dataUrl,
              compressedSize: blob.size
            });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function readFileAsBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert file to base64'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a compressed file or document to Cloudinary via server proxy.
 * Checks and validates that size is strictly <= 1MB.
 */
export async function uploadToCloudinary(
  fileOrBase64: File | Blob | string,
  options?: { folder?: string; fileName?: string; resourceType?: 'auto' | 'image' | 'raw' }
): Promise<UploadResult> {
  let base64Data: string;

  if (typeof fileOrBase64 === 'string') {
    base64Data = fileOrBase64;
    const estBytes = Math.round((base64Data.length * 3) / 4);
    if (estBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Upload payload exceeds maximum allowed size of 1.0MB (${(estBytes / 1024 / 1024).toFixed(2)}MB).`);
    }
  } else if (fileOrBase64 instanceof File && fileOrBase64.type.startsWith('image/')) {
    const compressed = await compressImage(fileOrBase64);
    base64Data = compressed.base64;
  } else {
    // Non-image file (PDF, CoA, SDS doc, etc.)
    if (fileOrBase64.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${(fileOrBase64.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of 1.0MB.`);
    }
    base64Data = await readFileAsBase64(fileOrBase64);
  }

  const token = localStorage.getItem('token');
  const response = await fetch('/api/upload/cloudinary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      data: base64Data,
      folder: options?.folder || 'ummis_inventory',
      name: options?.fileName || (fileOrBase64 instanceof File ? fileOrBase64.name : 'upload_doc'),
      resource_type: options?.resourceType || 'auto'
    })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorBody.error || `Upload failed with HTTP ${response.status}`);
  }

  const result = await response.json();
  return {
    url: result.url,
    public_id: result.public_id,
    format: result.format,
    bytes: result.bytes || 0
  };
}
