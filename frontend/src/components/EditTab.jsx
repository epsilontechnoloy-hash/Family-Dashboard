      </div>
    </div>
  );
}

// ── Screensaver Editor ───────────────────────────────────────────────────────

function ScreensaverEditor({ isMobile, onPreviewScreensaver, onScreensaverSettingsSaved }) {
  const [photos, setPhotos] = useState([]);
  const [settings, setSettings] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { refreshPhotos(); }, []);
  useEffect(() => { api.getScreensaverSettings().then(setSettings).catch(console.error); }, []);

  function refreshPhotos() {
    api.getPhotos().then(setPhotos).catch(console.error);
  }

  function uploadFileWithProgress(file) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('photo', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/photos/upload');
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          let message = `Upload failed (${xhr.status})`;
          try { message = JSON.parse(xhr.responseText).error || message; } catch { /* non-JSON error body, e.g. nginx 413 page */ }
          reject(new Error(message));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed — network error'));
      xhr.send(formData);
    });
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);
    setUploadError('');
    const failures = [];
    for (const file of files) {
      try {
        await uploadFileWithProgress(file);
        refreshPhotos();
      } catch (err) {
        console.error(err);
        failures.push(`${file.name}: ${err.message}`);
      }
    }
    setUploading(false);
    setProgress(0);
    if (failures.length > 0) {
      setUploadError(`${failures.length} of ${files.length} photo(s) failed to upload — ${failures.join('; ')}`);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function deletePhoto(filename) {
    await api.deletePhoto(filename);
    setPhotos(prev => prev.filter(p => p.filename !== filename));
  }

  async function addFromUrl() {
    if (!urlDraft.trim()) return;
    setUrlBusy(true);
    try {
      await api.fetchPhotoFromUrl(urlDraft.trim());
      setUrlDraft('');
      refreshPhotos();
    } catch (err) {
      console.error(err);
    } finally {
      setUrlBusy(false);
    }
  }

  async function saveSettings() {
    const res = await api.saveScreensaverSettings(settings);
    if (onScreensaverSettingsSaved) onScreensaverSettingsSaved(res.settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (!settings) return <div style={s.empty}>Loading screensaver settings…</div>;

  return (
    <div style={{ ...s.grid, ...(isMobile ? s.gridMobile : {}) }}>
      <div style={s.card}>
        <div style={{ ...s.personName, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="camera" size={18} /> Photos</div>

        <div
          style={{ ...s.dropZone, ...(dragOver ? s.dropZoneActive : {}) }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          <div style={{ ...s.dropZoneText, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {uploading ? `Uploading… ${progress}%` : <><Icon name="upload" size={18} /> Drag photos here, or click to browse</>}
          </div>
          {uploading && (
            <div style={s.progressBarTrack}>
              <div style={{ ...s.progressBarFill, width: `${progress}%` }} />
            </div>
          )}
        </div>

        {uploadError && (
          <div style={{ ...s.uploadError, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-triangle" size={15} /> {uploadError}
            <button style={s.uploadErrorDismiss} onClick={() => setUploadError('')} title="Dismiss" aria-label="Dismiss"><Icon name="x" size={14} /></button>
          </div>
        )}

        <div style={{ ...s.addRow, ...(isMobile ? s.addRowMobile : {}) }}>
          <input
            style={s.nameInput}
            type="text"
            placeholder="https://example.com/photo.jpg"
            value={urlDraft}
            onChange={e => setUrlDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addFromUrl(); }}
          />
          <button style={s.addBtn} onClick={addFromUrl} disabled={urlBusy}>
            {urlBusy ? 'Fetching…' : 'Add from URL'}
          </button>
        </div>

        <div style={s.photoGrid}>
          {photos.map(photo => (
            <div key={photo.filename} style={s.photoThumbWrap}>
