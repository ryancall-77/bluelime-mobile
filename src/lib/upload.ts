// Read a picked document/image into bytes for multipart upload.
//
// RN's classic FormData({ uri }) attachment yields 0-byte files on iOS. The fix
// (expo-file-system SDK 54+) is to read the file's actual bytes with the new
// File API and attach a real Blob. We import from expo-file-system directly
// (SDK 57 ships the new API at the package root); if a future SDK moves it,
// switch to `expo-file-system/next` / `/legacy`.

import { File } from 'expo-file-system';
import { supabase } from './supabase';

export interface FileBytes {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}

export async function readFileBytes(
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<FileBytes> {
  const file = new File(uri);
  // .bytes() returns a Uint8Array of the file contents.
  const bytes = await file.bytes();
  return { bytes, fileName, mimeType };
}

// Upload a picked image to the public property-photos bucket and return its
// public URL. Mirrors the website prepare page's client-side path
// (buyer/<analysisId>/<ts>-<name>). Uses a real Blob built from the file bytes
// (RN's { uri } FormData shim yields 0-byte files — same reason as make-offer).
export async function uploadListingPhoto(
  analysisId: string,
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const { bytes } = await readFileBytes(uri, fileName, mimeType);
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `buyer/${analysisId}/${Date.now()}-${safe}`;
  const blob = new Blob([bytes as BlobPart], { type: mimeType });
  const { error } = await supabase.storage
    .from('property-photos')
    .upload(path, blob, { upsert: true, contentType: mimeType });
  if (error) throw new Error(error.message || 'Upload failed');
  const { data } = supabase.storage.from('property-photos').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Could not get photo URL');
  return data.publicUrl;
}
