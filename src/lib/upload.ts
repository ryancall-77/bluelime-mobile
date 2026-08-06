// Read a picked document/image for multipart/Supabase-storage upload.
//
// RN's classic FormData({ uri }) attachment yields 0-byte files on iOS. The
// original fix here read the file into a Uint8Array and re-wrapped it as
// `new Blob([bytes])` — but RN's Blob polyfill rejects that construction
// outright ("Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not
// supported", hit in production 2026-08-06). expo-file-system's `File` class
// already `implements Blob` natively, so the fix is to stop reconstructing a
// Blob at all and just pass the File instance itself wherever a Blob/file
// body is expected — both FormData.append and Supabase Storage's .upload()
// accept it directly.

import { File } from 'expo-file-system';
import { supabase } from './supabase';

export interface PickedFile {
  file: File;
  fileName: string;
  mimeType: string;
}

export async function readPickedFile(
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<PickedFile> {
  return { file: new File(uri), fileName, mimeType };
}

// Upload a picked image to the public property-photos bucket and return its
// public URL. Mirrors the website prepare page's client-side path
// (buyer/<analysisId>/<ts>-<name>).
export async function uploadListingPhoto(
  analysisId: string,
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const { file } = await readPickedFile(uri, fileName, mimeType);
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `buyer/${analysisId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from('property-photos')
    .upload(path, file, { upsert: true, contentType: mimeType });
  if (error) throw new Error(error.message || 'Upload failed');
  const { data } = supabase.storage.from('property-photos').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Could not get photo URL');
  return data.publicUrl;
}
