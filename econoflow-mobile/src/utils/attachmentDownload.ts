import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';

const FALLBACK_FILE_NAME = 'attachment';

/** Keeps only characters that are safe in a cache file name. */
export function sanitizeAttachmentFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  return cleaned.length > 0 ? cleaned : FALLBACK_FILE_NAME;
}

const toAbsoluteUrl = (url: string): string =>
  url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

/**
 * Downloads an authenticated attachment to the cache and hands it to the
 * platform share sheet so the user can open or save it.
 *
 * Note: this bypasses the axios refresh interceptor, so an expired access token
 * surfaces as a download failure instead of a silent token refresh.
 */
export async function downloadAndOpenAttachment(
  url: string,
  fileName: string,
  mimeType?: string
): Promise<void> {
  const accessToken = useAuthStore.getState().accessToken;
  const targetUri = `${FileSystem.cacheDirectory}${sanitizeAttachmentFileName(fileName)}`;

  const download = await FileSystem.downloadAsync(toAbsoluteUrl(url), targetUri, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (download.status !== 200) {
    throw new Error(`Attachment download failed with status ${download.status}`);
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(download.uri, {
    mimeType: mimeType ?? 'application/octet-stream',
    UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
  });
}
