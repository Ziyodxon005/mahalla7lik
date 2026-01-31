-- Create a storage bucket for images
insert into storage.buckets (id, name, public) 
values ('murojaatlar', 'murojaatlar', true);

-- Policy to allow public viewing
create policy "Public Access" 
on storage.objects for select 
using ( bucket_id = 'murojaatlar' );

-- Policy to allow authenticated uploads
create policy "Authenticated Uploads" 
on storage.objects for insert 
with check ( bucket_id = 'murojaatlar' and auth.role() = 'authenticated' );
