-- Make the pdfs bucket public so AI can access files
UPDATE storage.buckets 
SET public = true 
WHERE id = 'pdfs';