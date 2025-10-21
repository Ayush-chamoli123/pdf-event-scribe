import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PdfUploadProps {
  onUploadComplete: () => void;
}

const PdfUpload = ({ onUploadComplete }: PdfUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter((file) => file.type === "application/pdf");
    if (pdfFiles.length !== acceptedFiles.length) {
      toast({
        title: "Invalid files",
        description: "Only PDF files are allowed",
        variant: "destructive",
      });
    }
    setFiles((prev) => [...prev, ...pdfFiles]);
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);

    try {
      const totalFiles = files.length;
      let completed = 0;

      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("pdfs")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Call edge function to process PDF
        const { error: processError } = await supabase.functions.invoke(
          "process-pdf",
          {
            body: { filePath, fileName: file.name },
          }
        );

        if (processError) {
          console.error("Error processing PDF:", processError);
          toast({
            title: "Processing error",
            description: `Failed to process ${file.name}`,
            variant: "destructive",
          });
        }

        completed++;
        setProgress((completed / totalFiles) * 100);
      }

      toast({
        title: "Success",
        description: `${files.length} PDF(s) uploaded and processed`,
      });

      setFiles([]);
      onUploadComplete();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">
            {isDragActive ? "Drop PDFs here" : "Upload PDF Files"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop PDF files here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Maximum file size: 20MB
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="font-medium">Selected Files ({files.length})</h4>
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-secondary rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {uploading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">
                  Processing PDFs... {Math.round(progress)}%
                </p>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full"
              size="lg"
            >
              {uploading ? "Uploading..." : `Upload ${files.length} PDF(s)`}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PdfUpload;
