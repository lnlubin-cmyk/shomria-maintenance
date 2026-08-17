-- Allow admin document uploads (community items + מכולת) to be raster images as
-- well as PDFs; the app renders whichever kind was uploaded. SVG is deliberately
-- excluded because it can carry embedded script.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
where id = 'community';
