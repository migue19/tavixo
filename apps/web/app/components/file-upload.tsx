"use client";
import { DragEvent, useEffect, useId, useRef, useState } from "react";

type Props = {
  label: string;
  description: string;
  acceptedTypes: string[];
  maxBytes: number;
  invalidMessage: string;
  file: File | null;
  disabled: boolean;
  onFileChange: (file: File | null) => void;
  onError: (message: string) => void;
};

export default function FileUpload({ label, description, acceptedTypes, maxBytes, invalidMessage, file, disabled, onFileChange, onError }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  useEffect(() => { if (disabled) { depth.current = 0; setDragging(false); } }, [disabled]);
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");
  function select(files: FileList) {
    if (disabled || !files.length) return;
    if (files.length !== 1) { onFileChange(null); onError("Agrega un solo archivo a la vez"); return; }
    const next = files[0];
    if (!acceptedTypes.includes(next.type) || next.size > maxBytes) {
      onFileChange(null); onError(invalidMessage); return;
    }
    onError(""); onFileChange(next);
  }
  return <div className="file-upload">
    <span className="file-upload-label" id={`${id}-label`}>{label}</span>
    <div className={`file-dropzone${dragging && !disabled ? " is-dragging" : ""}`} aria-disabled={disabled}
      onDragEnter={event => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        if (!disabled) { depth.current++; setDragging(true); }
      }}
      onDragOver={event => {
        if (!hasFiles(event)) return;
        event.preventDefault(); event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={event => {
        event.preventDefault(); depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDragging(false);
      }}
      onDrop={event => {
        // Prevent navigation even when uploads are temporarily disabled.
        event.preventDefault(); depth.current = 0; setDragging(false);
        if (hasFiles(event)) select(event.dataTransfer.files);
      }}>
      <svg className="file-upload-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></svg>
      <strong>{dragging && !disabled ? "Suelta el archivo aquí" : "Arrastra y suelta tu archivo aquí"}</strong>
      <span className="file-upload-alternative">o selecciónalo desde tu dispositivo</span>
      <input ref={input} type="file" accept={acceptedTypes.join(",")} hidden disabled={disabled}
        aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`}
        onChange={event => { if (event.target.files) select(event.target.files); event.target.value = ""; }} />
      <button type="button" className="secondary" disabled={disabled} aria-describedby={`${id}-label ${id}-help`} onClick={() => input.current?.click()}>
        {file ? "Cambiar archivo" : "Seleccionar archivo"}
      </button>
      <span className="file-upload-selected" role="status">{file ? `${file.name} · ${Math.ceil(file.size / 1024)} KB · pendiente de guardar` : "Ningún archivo nuevo seleccionado"}</span>
    </div>
    <small id={`${id}-help`}>{description}</small>
  </div>;
}
