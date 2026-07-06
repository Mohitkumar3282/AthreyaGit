import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const getOptimizedImageFormat = () =>
    String(process.env.CLOUDINARY_IMAGE_UPLOAD_FORMAT || '').trim().toLowerCase();

const getOptimizedImageQuality = () =>
    String(process.env.CLOUDINARY_IMAGE_UPLOAD_QUALITY || '').trim();

const isImageMimeType = (mimeType = '') =>
    String(mimeType || '').trim().toLowerCase().startsWith('image/');

const getImageUploadOptions = () => {
    const format = getOptimizedImageFormat();
    const quality = getOptimizedImageQuality();
    return {
        ...(format ? { format } : {}),
        ...(quality ? { transformation: `q_${quality}` } : {}),
    };
};

export const uploadToCloudinary = async (fileBuffer, folder = 'categories', options = {}) => {
    const mimeType = String(options.mimeType || 'image/jpeg').trim().toLowerCase();

    const getBase64Fallback = () => {
        if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
            return "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3Ccircle%20cx%3D%228.5%22%20cy%3D%228.5%22%20r%3D%221.5%22%2F%3E%3Cpolyline%20points%3D%2221%2015%2016%2010%205%2021%22%2F%3E%3C%2Fsvg%3E";
        }
        const base64Data = fileBuffer.toString("base64");
        return `data:${mimeType};base64,${base64Data}`;
    };

    try {
        const resourceType = String(options.resourceType || '').trim().toLowerCase();
        const shouldOptimizeImage =
            options.optimize !== false &&
            (resourceType === 'image' || isImageMimeType(mimeType));

        return await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: shouldOptimizeImage ? 'image' : 'auto',
                    ...(shouldOptimizeImage ? getImageUploadOptions() : {}),
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result.secure_url);
                    }
                }
            );
            uploadStream.end(fileBuffer);
        });
    } catch (error) {
        return getBase64Fallback();
    }
};

export default cloudinary;
