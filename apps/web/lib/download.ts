/**
 * Save a server response as a file without leaving the page.
 *
 * Fetched as a blob rather than navigated to, so the user stays on the
 * dashboard and a failure is catchable — a plain link navigation gives no
 * signal if it goes wrong, and here the download is the only copy that
 * outlives the retention window.
 */
export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filenameFrom(response.headers.get('content-disposition')) || fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser a moment to start reading the blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }
}

/** Pull the filename out of a Content-Disposition header, if it is readable. */
function filenameFrom(header: string | null): string | null {
  if (!header) return null;

  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted) return quoted[1];

  const bare = header.match(/filename=([^;]+)/i);
  return bare ? bare[1].trim() : null;
}

/** A filesystem-safe name derived from a match title. */
export function exportFilename(matchName: string): string {
  const safe = (matchName || 'match')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80);
  return `${safe}-${new Date().toISOString().slice(0, 10)}.json`;
}
