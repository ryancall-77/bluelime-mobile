// Read a picked document/image into bytes for multipart upload.
//
// RN's classic FormData({ uri }) attachment yields 0-byte files on iOS. The fix
// (expo-file-system SDK 54+) is to read the file's actual bytes with the new
// File API and attach a real Blob. We import from expo-file-system directly
// (SDK 57 ships the new API at the package root); if a future SDK moves it,
// switch to `expo-file-system/next` / `/legacy`.

import { File } from 'expo-file-system';

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
