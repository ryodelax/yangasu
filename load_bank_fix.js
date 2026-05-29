(async () => {
  try {
    const t = await fetch('http://127.0.0.1:8765/bank_pdf_import.gs?' + Date.now()).then(r => r.text());
    const models = (window.monaco && monaco.editor && monaco.editor.getModels) ? monaco.editor.getModels() : [];
    const m = models.find(x => String((x.uri && x.uri.path) || '').includes('bank_pdf_import.gs')) || models[0];
    if (!m) {
      alert('model not found');
      return;
    }
    m.setValue(t);
    alert('bank_pdf_import.gs loaded: ' + t.length);
  } catch (e) {
    alert('loader failed: ' + (e && e.message ? e.message : e));
  }
})();
