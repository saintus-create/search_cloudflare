const MAX_FILE_BYTES = 100 * 1024;
const ACCEPTED_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'html', 'htm']);

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() || '';

const titleFromFilename = (name: string) => {
  const withoutExtension = name.replace(/\.[^.]+$/, '');
  return withoutExtension.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Uploaded document';
};

const normalizeContent = async (file: File) => {
  const extension = extensionOf(file.name);
  const raw = await file.text();

  if (extension === 'json') {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      throw new Error('The JSON file is not valid JSON.');
    }
  }

  if (extension === 'html' || extension === 'htm') {
    const document = new DOMParser().parseFromString(raw, 'text/html');
    document.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
    return (document.body?.textContent || document.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return raw.replace(/\r\n?/g, '\n').trim();
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

const uploadFile = async (file: File) => {
  const extension = extensionOf(file.name);
  if (!ACCEPTED_EXTENSIONS.has(extension)) {
    throw new Error('Supported files: TXT, Markdown, CSV, JSON, and HTML.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That file is larger than the 100 KB document limit.');
  }

  const content = await normalizeContent(file);
  if (!content) throw new Error('The document contains no readable text.');
  if (content.length > 100_000) throw new Error('The document contains more than 100,000 characters.');

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: titleFromFilename(file.name),
      content,
      metadata: {
        source: 'file_upload',
        filename: file.name,
        contentType: file.type || 'text/plain',
        size: file.size,
      },
    }),
  });

  const data = await response.json() as { success?: boolean; error?: string };
  if (!response.ok || !data.success) throw new Error(data.error || 'Upload failed.');
  return titleFromFilename(file.name);
};

const init = () => {
  const uploadButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Upload');
  if (!uploadButton) return;

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.txt,.md,.csv,.json,.html,.htm,text/plain,text/markdown,text/csv,application/json,text/html';
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
      const title = await uploadFile(file);
      showStatus(`Indexed: ${title}`);
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
