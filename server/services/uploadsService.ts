import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { UPLOAD_DIR } from '../db.ts';

export function saveUploadedReceiptImage(params: {
  filename: string;
  mimeType: string;
  dataBase64: string;
}): { ok: boolean; error?: string; url?: string; name?: string } {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const ext = mimeToExt[params.mimeType];
  if (!ext) {
    return {
      ok: false,
      error: 'Format gambar harus JPG, PNG, atau WEBP.',
    };
  }
  const cleanB64 = params.dataBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  const buffer = Buffer.from(cleanB64, 'base64');
  if (buffer.length === 0 || buffer.length > 4 * 1024 * 1024) {
    return {
      ok: false,
      error: 'Ukuran gambar maksimal 4 MB dan tidak boleh kosong.',
    };
  }

  // Validate image magic bytes
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  const isPng =
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (
    (ext === 'jpg' && !isJpeg) ||
    (ext === 'png' && !isPng) ||
    (ext === 'webp' && !isWebp)
  ) {
    return {
      ok: false,
      error: 'Isi file tidak cocok dengan format gambar yang dipilih.',
    };
  }

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  const storedName = `nota-${crypto.randomUUID().slice(0, 12)}.${ext}`;
  const targetPath = path.resolve(UPLOAD_DIR, storedName);
  if (!targetPath.startsWith(UPLOAD_DIR + path.sep)) {
    return { ok: false, error: 'Path penyimpanan tidak valid.' };
  }
  fs.writeFileSync(targetPath, buffer);

  const displayName =
    params.filename.replace(/[^\w.\- ]+/g, '').trim().slice(0, 80) ||
    storedName;

  return {
    ok: true,
    url: `/api/uploads/${storedName}`,
    name: displayName,
  };
}

export function resolveUploadedReceiptPath(
  filename: string
): { path: string; contentType: string } | null {
  if (!/^[a-zA-Z0-9_\-]+\.(jpg|png|webp)$/.test(filename)) {
    return null;
  }
  const resolved = path.resolve(UPLOAD_DIR, filename);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) {
    return null;
  }
  if (!fs.existsSync(resolved)) {
    return null;
  }
  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
      ? 'image/webp'
      : 'image/jpeg';
  return { path: resolved, contentType };
}
