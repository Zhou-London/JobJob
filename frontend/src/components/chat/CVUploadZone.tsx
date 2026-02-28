"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";

interface CVUploadZoneProps {
    onUpload: (file: File) => void;
    isUploading: boolean;
}

export function CVUploadZone({ onUpload, isUploading }: CVUploadZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFile = useCallback(
        (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (!ext || !["pdf", "docx", "doc"].includes(ext)) {
                alert("Please upload a PDF or DOCX file.");
                return;
            }
            setFileName(file.name);
            onUpload(file);
        },
        [onUpload]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        },
        [handleFile]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
        },
        [handleFile]
    );

    return (
        <Card
            className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() =>
                document.getElementById("cv-upload-input")?.click()
            }
        >
            <input
                id="cv-upload-input"
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={handleChange}
                disabled={isUploading}
            />

            {isUploading ? (
                <div className="text-muted-foreground">
                    <div className="text-2xl mb-2">⏳</div>
                    <p className="text-sm">Uploading & parsing {fileName}...</p>
                </div>
            ) : fileName ? (
                <div className="text-muted-foreground">
                    <div className="text-2xl mb-2">✅</div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs mt-1">Click or drag to replace</p>
                </div>
            ) : (
                <div className="text-muted-foreground">
                    <div className="text-2xl mb-2">📄</div>
                    <p className="text-sm font-medium">
                        Drop your CV here, or click to browse
                    </p>
                    <p className="text-xs mt-1">PDF or DOCX</p>
                </div>
            )}
        </Card>
    );
}
