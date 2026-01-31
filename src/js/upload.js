import { supabase } from './supabase.js';

/**
 * Rasm yuklash - Supabase Storage
 * Yuklashdan oldin rasmni kichraytiradi (800px, 70% sifat)
 */

// Rasmni kichraytirish (Canvas orqali, kutubxona kerak emas)
async function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Yangi o'lchamni hisoblash
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            // Canvas yaratish
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Blob olish
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        // Yangi nom bilan File yaratish
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        console.log(`Rasm kichraytirildi: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB`);
                        resolve(compressedFile);
                    } else {
                        reject(new Error('Rasmni siqishda xatolik'));
                    }
                },
                'image/jpeg',
                quality
            );
        };
        img.onerror = () => reject(new Error('Rasmni yuklashda xatolik'));
        img.src = URL.createObjectURL(file);
    });
}

export async function uploadToTelegraph(file) {
    // Fayl hajmini tekshirish (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Rasm hajmi 5MB dan oshmasligi kerak");
    }

    // Faqat rasm formatlarini qabul qilish
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error("Faqat JPG, PNG, GIF, WEBP formatlar qo'llab-quvvatlanadi");
    }

    try {
        // 1. Rasmni kichraytirish (GIF bundan mustasno)
        let fileToUpload = file;
        if (file.type !== 'image/gif') {
            fileToUpload = await compressImage(file, 800, 0.7);
        }

        // 2. Unikal fayl nomi
        const fileExt = 'jpg'; // Hammasi JPEG ga aylanadi
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        // 3. Supabase Storage ga yuklash
        const { data, error } = await supabase.storage
            .from('murojaatlar')
            .upload(fileName, fileToUpload, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // 4. Public URL olish
        const { data: { publicUrl } } = supabase.storage
            .from('murojaatlar')
            .getPublicUrl(fileName);

        console.log('Rasm yuklandi:', publicUrl);
        return publicUrl;

    } catch (error) {
        console.error('Upload Error:', error);
        throw new Error('Rasm yuklashda xatolik: ' + error.message);
    }
}
