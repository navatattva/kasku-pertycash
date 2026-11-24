import { useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { ApiError, pettycashApi } from '../../api/pettycashApi.ts';
import { SecureReceiptImage } from './SecureReceiptImage.tsx';

export interface UploadedReceiptImage {
  url: string;
  name: string;
}

interface ReceiptUploaderProps {
  inputId: string;
  labelText: string;
  isRequired?: boolean;
  value: UploadedReceiptImage | null;
  onChange: (next: UploadedReceiptImage | null) => void;
  onError: (message: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  idleTitle?: string;
  uploadingText?: string;
  helperText?: string;
  requiredHelperText?: string;
  readyText?: string;
  previewSizeClass?: string;
  sizeErrorMessage?: string;
  typeErrorMessage?: string;
  networkErrorMessage?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

export function ReceiptUploader({
  inputId,
  labelText,
  isRequired = false,
  value,
  onChange,
  onError,
  onUploadingChange,
  idleTitle = 'Pilih foto nota, invoice, atau struk tol/BBM',
  uploadingText = 'Mengunggah gambar nota...',
  helperText,
  requiredHelperText,
  readyText = 'Gambar nota siap dilampirkan',
  previewSizeClass = 'h-14 w-14 rounded-md',
  sizeErrorMessage = 'Ukuran gambar nota maksimal 4 MB.',
  typeErrorMessage = 'Format lampiran harus berupa gambar JPG, PNG, atau WEBP.',
  networkErrorMessage = 'Gagal mengunggah foto nota ke server.',
}: ReceiptUploaderProps) {
  const [uploading, setUploading] = useState(false);

  function updateUploading(next: boolean) {
    setUploading(next);
    onUploadingChange?.(next);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    onError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      onError(typeErrorMessage);
      e.target.value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      onError(sizeErrorMessage);
      e.target.value = '';
      return;
    }

    updateUploading(true);
    try {
      const dataBase64 = await readFileAsDataUrl(file);
      const uploaded = await pettycashApi.uploadReceiptImage({
        filename: file.name,
        mimeType: file.type,
        dataBase64,
      });
      onChange({ url: uploaded.url, name: uploaded.name });
    } catch (err) {
      onError(err instanceof ApiError ? err.message : networkErrorMessage);
    } finally {
      updateUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-xs font-semibold text-slate-700 mb-1"
      >
        {labelText}{' '}
        {isRequired ? (
          <span className="text-rose-700">
            (Wajib · Guard Anti-Fraud Aktif)
          </span>
        ) : (
          '(JPG, PNG, WEBP · Maks 4 MB)'
        )}
      </label>

      {value ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SecureReceiptImage
              src={value.url}
              alt={`Pratinjau ${value.name}`}
              className={`${previewSizeClass} object-cover border border-slate-200 bg-white shrink-0`}
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {value.name}
              </p>
              <p className="text-xs text-emerald-700">{readyText}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Hapus lampiran gambar"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus</span>
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-4 text-center cursor-pointer transition-colors ${
            isRequired
              ? 'border-amber-400 bg-amber-50/40 hover:border-emerald-600 hover:bg-emerald-50/30'
              : 'border-slate-300 bg-slate-50 hover:border-emerald-600 hover:bg-emerald-50/30'
          }`}
        >
          <Upload className="h-5 w-5 text-slate-400 mb-1" />
          <span className="text-xs font-medium text-slate-700">
            {uploading ? uploadingText : idleTitle}
          </span>
          {(helperText || requiredHelperText) && (
            <span className="text-xs text-slate-500 mt-0.5">
              {isRequired && requiredHelperText
                ? requiredHelperText
                : helperText}
            </span>
          )}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={uploading}
            className="sr-only"
          />
        </label>
      )}
    </div>
  );
}
