import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';

type Theme = 'light' | 'dark';

interface ImageCropperProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  onCropComplete: (croppedImageUrl: string) => void;
  theme: Theme;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ isOpen, onClose, imageSrc, onCropComplete, theme }) => {
    const [crop, setCrop] = useState<Crop>();
    const imgRef = useRef<HTMLImageElement>(null);

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const newCrop = centerCrop(
            makeAspectCrop(
                {
                    unit: '%',
                    width: 90,
                },
                1, // aspect ratio 1:1
                width,
                height
            ),
            width,
            height
        );
        setCrop(newCrop);
    };

    const handleCrop = async () => {
        if (imgRef.current && crop?.width && crop?.height) {
            const canvas = document.createElement('canvas');
            const image = imgRef.current;
            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;
            
            canvas.width = crop.width;
            canvas.height = crop.height;

            const ctx = canvas.getContext('2d');

            if (ctx) {
                ctx.drawImage(
                    image,
                    crop.x * scaleX,
                    crop.y * scaleY,
                    crop.width * scaleX,
                    crop.height * scaleY,
                    0,
                    0,
                    crop.width,
                    crop.height
                );
                const base64Image = canvas.toDataURL('image/jpeg');
                onCropComplete(base64Image);
            }
        }
    };

    if (!isOpen || !imageSrc) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl max-w-lg w-full`}>
                <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Crop Image</h3>
                <div className="flex justify-center bg-gray-200 dark:bg-gray-700 p-2 rounded">
                    {imageSrc && (
                        <ReactCrop
                            crop={crop}
                            onChange={c => setCrop(c)}
                            aspect={1}
                            minWidth={100}
                        >
                            <img ref={imgRef} src={imageSrc} onLoad={onImageLoad} alt="Crop preview" style={{ maxHeight: '70vh' }} />
                        </ReactCrop>
                    )}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                    <button onClick={handleCrop} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Crop & Save</button>
                </div>
            </div>
        </div>
    );
};

export default ImageCropper;
