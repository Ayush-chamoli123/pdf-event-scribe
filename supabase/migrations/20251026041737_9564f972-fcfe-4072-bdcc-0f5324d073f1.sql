-- Create documents table to track processing status
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  events_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Allow public access (since no auth is implemented)
CREATE POLICY "Allow public read access" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.documents FOR UPDATE USING (true);

-- Add index for faster queries
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);