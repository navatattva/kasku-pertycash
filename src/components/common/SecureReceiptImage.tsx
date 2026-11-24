import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { fetchAuthorizedBlobUrl } from '../../api/pettycashApi.ts';

interface SecureReceiptImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function SecureReceiptImage({
  src,
  alt,
  className = '',
}: SecureReceiptImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (!src) {
      setFailed(true);
      return;
    }

    // If already a local data URL (e.g. preview before submit), render directly
    if (src.startsWith('data:image/')) {
      setBlobUrl(src);
      setFailed(false);
      return;
    }

    setFailed(false);
    setBlobUrl(null);

    fetchAuthorizedBlobUrl(src)
      .then((url) => {
        createdUrl = url;
        if (active) {
          setBlobUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src]);

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-100 p-6 text-slate-500">
        <ImageOff className="h-6 w-6 mb-1.5" />
        <span className="text-xs">Lampiran nota tidak dapat dimuat</span>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div
        className={`animate-pulse rounded-lg bg-slate-200 ${className || 'h-48 w-full'}`}
      />
    );
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}
