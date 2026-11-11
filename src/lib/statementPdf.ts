// Shared PDF rendering + share/download for statement (صورتحساب) dialogs.

const waitForAssets = async (root: HTMLElement) => {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            setTimeout(done, 8000);
          })
    )
  );
  try {
    await (document as any).fonts?.ready;
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 250));
};

/** Render statement HTML into a PDF blob. multiPage splits long content over A4 pages. */
export async function renderStatementPdfBlob(styles: string, html: string, multiPage = true): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  const container = document.createElement('div');
  container.innerHTML = `<style>${styles.replace(/<\/?style>/g, '')}</style>${html}`;
  Object.assign(container.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '210mm',
    background: 'white',
    direction: 'rtl',
    fontFamily: 'Vazirmatn, Tahoma, Arial, sans-serif',
  });
  document.body.appendChild(container);
  try {
    await waitForAssets(container);
    const target = (container.querySelector('.invoice-container') as HTMLElement) || container;
    const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const imgW = availW;
    const imgH = (canvas.height * imgW) / canvas.width;
    if (!multiPage || imgH <= availH) {
      let drawW = imgW;
      let drawH = imgH;
      if (drawH > availH) { drawH = availH; drawW = (canvas.width * drawH) / canvas.height; }
      pdf.addImage(dataUrl, 'JPEG', (pageW - drawW) / 2, margin, drawW, drawH);
    } else {
      let remaining = imgH;
      let offset = 0;
      while (remaining > 0) {
        pdf.addImage(dataUrl, 'JPEG', margin, margin - offset, imgW, imgH);
        remaining -= availH;
        offset += availH;
        if (remaining > 0) pdf.addPage();
      }
    }
    return pdf.output('blob');
  } finally {
    container.remove();
  }
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Returns 'shared' | 'downloaded' | 'cancelled' | 'retry' (browser dropped the tap while the PDF was being built). */
export async function sharePdfBlob(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled' | 'retry'> {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text: title });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      if ((e as DOMException)?.name === 'NotAllowedError') return 'retry';
    }
  }
  downloadPdfBlob(blob, filename);
  return 'downloaded';
}
