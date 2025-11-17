-- Make project-media bucket public
UPDATE storage.buckets 
SET public = true 
WHERE name = 'project-media';