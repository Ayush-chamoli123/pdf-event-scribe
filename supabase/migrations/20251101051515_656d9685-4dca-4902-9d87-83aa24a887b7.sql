-- Add processing time and confidence score columns to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS processing_time_seconds DECIMAL,
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL;