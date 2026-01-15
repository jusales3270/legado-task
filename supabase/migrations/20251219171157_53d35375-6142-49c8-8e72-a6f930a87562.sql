-- Create storage bucket for card attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-attachments', 'card-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for card attachments
CREATE POLICY "Anyone can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'card-attachments');

CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'card-attachments');

CREATE POLICY "Users can update their attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'card-attachments');

CREATE POLICY "Users can delete attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'card-attachments');