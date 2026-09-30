"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Trash2, File as FileIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KycDocumentUploadProps {
  fieldId: string;
  label: string;
  description?: string;
  isRequired?: boolean;
  disabled?: boolean;
  existingDocument?: { id: string; originalFilename: string; status: string } | null;
  onUploadComplete: (doc: any) => void;
  onDeleteComplete: (fieldId: string) => void;
  error?: string;
}

export function KycDocumentUpload({
  fieldId,
  label,
  description,
  isRequired,
  disabled,
  existingDocument,
  onUploadComplete,
  onDeleteComplete,
  error,
}: KycDocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayError = localError || error;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("fieldId", fieldId);
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/merchant/kyc/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onUploadComplete(data.document);
      } else {
        setLocalError(data.error || "Upload failed");
      }
    } catch (err: any) {
      setLocalError("A network error occurred while uploading.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!existingDocument) return;
    setLocalError(null);
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/v1/merchant/kyc/documents/${existingDocument.id}`, {
        method: "DELETE",
      });

      if (res.ok || res.status === 404) {
        onDeleteComplete(fieldId);
      } else {
        const data = await res.json();
        setLocalError(data.error || "Failed to delete document");
      }
    } catch (err: any) {
      setLocalError("A network error occurred while deleting.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-1">
        <label className="text-[13px] font-medium text-foreground">
          {label}
        </label>
        {isRequired && <span className="text-destructive">*</span>}
      </div>
      {description && <p className="text-[12.5px] text-muted-foreground">{description}</p>}

      <div
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-colors ${
          displayError ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30 hover:bg-muted/50 hover:border-indigo-500/50"
        } ${(disabled || isUploading || isDeleting) ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {existingDocument ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3 overflow-hidden">
              <FileIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <div className="truncate">
                <p className="text-[13.5px] font-medium text-foreground truncate">
                  {existingDocument.originalFilename}
                </p>
                <p className="text-[12.5px] text-emerald-600 dark:text-emerald-500 font-medium">
                  {existingDocument.status === "UPLOADED" ? "Uploaded successfully" : "Pending..."}
                </p>
              </div>
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="Delete document"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
        ) : (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={disabled || isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              aria-label={`Upload ${label}`}
            />
            <div className="flex flex-col items-center justify-center space-y-2 text-center pointer-events-none">
              {isUploading ? (
                <Loader2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
              ) : (
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
              )}
              <div className="text-[13.5px] text-muted-foreground">
                {isUploading ? (
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">Uploading...</span>
                ) : (
                  <>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">Click to upload</span> or drag and drop
                  </>
                )}
              </div>
              {!isUploading && <p className="text-[12px] text-muted-foreground/70">PDF, JPG, PNG (max 5MB)</p>}
            </div>
          </>
        )}
      </div>
      {displayError && <p className="text-[12.5px] font-medium text-destructive mt-1">{displayError}</p>}
    </div>
  );
}
