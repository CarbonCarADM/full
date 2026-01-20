import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const compressImage = async (file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
             reject(new Error('Canvas context unavailable'));
             return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        }, file.type, quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const formatPhone = (value: string) => {
  if (!value) return "";
  
  // Remove tudo que não é dígito
  const cleanValue = value.replace(/\D/g, "");
  
  // Aplica a máscara (XX) XXXXX-XXXX
  if (cleanValue.length <= 11) {
    return cleanValue
      .replace(/^(\d{2})(\d)/g, "($1) $2")
      .replace(/(\d)(\d{4})$/, "$1-$2");
  }
  
  // Limita a 11 dígitos se passar
  return cleanValue.slice(0, 11).replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d)(\d{4})$/, "$1-$2");
};

export const formatPlate = (value: string) => {
  if (!value) return "";
  // Remove caracteres especiais e limita a 7 caracteres alfanuméricos
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
};