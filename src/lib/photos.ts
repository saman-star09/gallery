import { supabase } from './supabaseClient';
import type { Photo } from './types';

const TABLE = 'photos';
const BUCKET = 'photos';

interface PhotoRow {
  id: string;
  storage_path: string;
  width: number;
  height: number;
  caption: string | null;
  created_at: string;
  owner_id: string;
}

function publicUrlFor(storagePath: string): string {
  return supabase!.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

function toPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    storagePath: row.storage_path,
    url: publicUrlFor(row.storage_path),
    width: row.width,
    height: row.height,
    caption: row.caption,
    createdAt: row.created_at,
    ownerId: row.owner_id,
  };
}

export async function listPhotos(): Promise<Photo[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as PhotoRow[]).map(toPhoto);
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      reject(new Error(`Could not read "${file.name}" as an image`));
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  });
}

export async function uploadPhoto(file: File, ownerId: string, caption = ''): Promise<Photo> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { width, height } = await readImageDimensions(file);

  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const storagePath = `${ownerId}/${crypto.randomUUID()}${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error: insertError } = await supabase
    .from(TABLE)
    .insert({ storage_path: storagePath, width, height, caption: caption || null, owner_id: ownerId })
    .select()
    .single();
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(insertError.message);
  }

  return toPhoto(data as PhotoRow);
}

export async function deletePhoto(photo: Photo): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error: dbError } = await supabase.from(TABLE).delete().eq('id', photo.id);
  if (dbError) throw new Error(dbError.message);
  await supabase.storage.from(BUCKET).remove([photo.storagePath]);
}

export async function updateCaption(id: string, caption: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from(TABLE)
    .update({ caption: caption || null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export function subscribeToPhotos(onInsert: (photo: Photo) => void, onDelete: (id: string) => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel('photos-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, (payload) => {
      onInsert(toPhoto(payload.new as PhotoRow));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE }, (payload) => {
      onDelete((payload.old as { id: string }).id);
    })
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
