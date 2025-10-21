-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  description TEXT NOT NULL,
  source_pdf TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create policies for events table (public access for now)
CREATE POLICY "Allow public read access to events"
  ON public.events FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to events"
  ON public.events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to events"
  ON public.events FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to events"
  ON public.events FOR DELETE
  USING (true);

-- Create index for faster queries
CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_events_source ON public.events(source_pdf);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdfs',
  'pdfs',
  false,
  20971520,
  ARRAY['application/pdf']
);

-- Storage policies for PDFs
CREATE POLICY "Allow public upload to pdfs bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pdfs');

CREATE POLICY "Allow public read from pdfs bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pdfs');

CREATE POLICY "Allow public delete from pdfs bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pdfs');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();