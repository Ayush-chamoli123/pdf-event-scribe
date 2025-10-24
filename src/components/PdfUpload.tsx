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
      <Card className="p-8 shadow-lg border-border/50 backdrop-blur-sm bg-card/80">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all duration-300 ${
            isDragActive
              ? "border-primary bg-primary/10 scale-[1.02]"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full transition-all duration-300 ${
              isDragActive ? "bg-primary/20" : "bg-muted"
            }`}>
              <Upload className={`h-10 w-10 transition-colors ${
                isDragActive ? "text-primary" : "text-muted-foreground"
              }`} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">
                {isDragActive ? "Drop PDFs here" : "Upload PDF Files"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop PDF files here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground/70">
                Maximum file size: 20MB
              </p>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">Selected Files</h4>
              <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
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
                    className="hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {uploading && (
              <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-center text-muted-foreground font-medium">
                  AI Agent analyzing PDFs and extracting events... {Math.round(progress)}%
                </p>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full shadow-md hover:shadow-lg transition-all"
              size="lg"
            >
              {uploading ? "Extracting with AI Agent..." : `Extract Events using AI Agent (${files.length} PDF${files.length !== 1 ? 's' : ''})`}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PdfUpload;
