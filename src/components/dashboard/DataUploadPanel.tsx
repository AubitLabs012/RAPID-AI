import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { CheckCircle2, FileImage, FileText, FileUp, Loader2 } from "lucide-react";
import { uploadMarineImage, uploadMarinePdf } from "../../api";
import type { MarineMarker } from "../../types";
import { useDashboardStore } from "../../store";
import { Button } from "../ui/button";

type UploadSummary = {
  parsed_records: number;
  valid_observations: number;
  stored: Record<string, number>;
  ai: Record<string, number>;
  markers?: MarineMarker[];
  analysis?: string;
  filename?: string;
};

type UploadMode = "pdf" | "image";

export function DataUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<UploadMode>("pdf");
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const setUploadedMarkers = useDashboardStore((state) => state.setUploadedMarkers);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function chooseMode(nextMode: UploadMode) {
    setMode(nextMode);
    setFile(null);
    setSummary(null);
    setError("");
    window.setTimeout(() => {
      if (nextMode === "pdf") {
        pdfInputRef.current?.click();
      } else {
        imageInputRef.current?.click();
      }
    }, 0);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>, nextMode: UploadMode) {
    setMode(nextMode);
    setFile(event.currentTarget.files?.[0] ?? null);
    setSummary(null);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError("");
    setSummary(null);

    try {
      const result = mode === "pdf"
        ? await uploadMarinePdf(file)
        : await uploadMarineImage(file);
      setSummary(result);
      setUploadedMarkers(result.markers ?? [], result.analysis ?? "");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="pdf-upload-panel glass-panel" aria-label="Data record upload">
      <header>
        <span aria-hidden="true"><FileUp size={20} /></span>
        <div>
          <h2>Data Upload</h2>
          <p>Send record tables to model analysis.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="upload-option-grid">
          <button className={mode === "pdf" ? "active" : ""} type="button" onClick={() => chooseMode("pdf")}>
            <FileText size={18} />
            PDF
          </button>
          <button className={mode === "image" ? "active" : ""} type="button" onClick={() => chooseMode("image")}>
            <FileImage size={18} />
            Image
          </button>
        </div>

        <input
          ref={pdfInputRef}
          className="hidden-upload-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => handleFileChange(event, "pdf")}
          aria-label="PDF record file"
        />
        <input
          ref={imageInputRef}
          className="hidden-upload-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          onChange={(event) => handleFileChange(event, "image")}
          aria-label="Image record file"
        />

        <p className="selected-upload-file">{file?.name ?? `Choose a ${mode === "pdf" ? "PDF" : "record image"}`}</p>

        <Button type="submit" disabled={!file || isUploading}>
          {isUploading ? <Loader2 size={17} className="spin" /> : <FileUp size={17} />}
          Upload
        </Button>
      </form>

      {summary && (
        <div className="pdf-upload-result">
          <CheckCircle2 size={18} aria-hidden="true" />
          <dl>
            <div><dt>Parsed</dt><dd>{summary.parsed_records}</dd></div>
            <div><dt>Valid</dt><dd>{summary.valid_observations}</dd></div>
            <div><dt>Predictions</dt><dd>{summary.ai.predictions ?? 0}</dd></div>
            <div><dt>Alerts</dt><dd>{summary.ai.alerts ?? 0}</dd></div>
          </dl>
          {summary.analysis && <p className="upload-analysis">{summary.analysis}</p>}
        </div>
      )}

      {error && <p className="pdf-upload-error">{error}</p>}
    </section>
  );
}
