const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 100_000;

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() || '';

const titleFromFilename = (name: string) => {
  const withoutExtension = name.replace(/\.[^.]+$/, '');
  return withoutExtension.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Uploaded document';
};

const showStatus = (message: string, error = false) => {
  let status = document.getElementById('upload-automation-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'upload-automation-status';
    status.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100%-2rem)] rounded-xl px-5 py-3 text-sm font-medium shadow-lg';
    document.body.appendChild(status);
  }
  status.textContent = message;
  status.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100%-2rem)] rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${error ? 'bg-error text-error-content' : 'bg-base-content text-base-100'}`;
  window.setTimeout(() => status?.remove(), error ? 5000 : 3000);
};

const toBase64 = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const extractText = async (file: File) => {
  const extension = extensionOf(file.name);
  const raw = await file.text();

  if (extension === 'json') {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  if (extension === 'html' || extension === 'htm') {
    const document = new DOMParser().parseFromString(raw, 'text/html');
    document.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
    return (document.body?.textContent || document.textContent || '').replace(/\s+/g, ' ').trim();
  }

  const looksBinary = raw.includes('\u0000') || (file.type && !file.type.startsWith('text/'));
  if (looksBinary) return '';
  return raw.replace(/\r\n?/g, '\n').trim();
};

const uploadFile = async (file: File) => {
  if (file.size > MAX_FILE_BYTES) throw new Error('Files are limited to 5 MB.');

  const title = titleFromFilename(file.name);
  const content = await extractText(file);
  const originalData = await toBase64(file);

  if (content.length > MAX_TEXT_CHARS) throw new Error('The searchable text exceeds the 100,000 character limit.');

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      content: content || `[Binary file: ${file.name}]`,
      metadata: {
        source: 'file_upload',
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        extension: extensionOf(file.name),
        encoding: 'base64',
        originalData,
        searchable: Boolean(content),
      },
    }),
  });

  const data = await response.json() as { success?: boolean; error?: string };
  if (!response.ok || !data.success) throw new Error(data.error || 'Upload failed.');
  return { title, searchable: Boolean(content) };
};

const init = () => {
  const uploadButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Upload');
  if (!uploadButton) return;

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '*/*';
  picker.hidden = true;
  document.body.appendChild(picker);

  uploadButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    picker.value = '';
    picker.click();
  }, true);

  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    if (!file) return;

    uploadButton.setAttribute('disabled', 'true');
    const original = uploadButton.innerHTML;
    uploadButton.textContent = 'Uploading…';

    try {
      const result = await uploadFile(file);
      showStatus(result.searchable ? `Indexed: ${result.title}` : `Stored: ${result.title} (not text-searchable)`);
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'Upload failed.', true);
    } finally {
      uploadButton.removeAttribute('disabled');
      uploadButton.innerHTML = original;
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
