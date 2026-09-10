import './style.css';
import { isConfigured } from './lib/supabaseClient';
import { onAuthChange } from './lib/auth';
import { deletePhoto, listPhotos, subscribeToPhotos, updateCaption } from './lib/photos';
import type { Photo } from './lib/types';
import { Lightbox } from './components/Lightbox';
import { Masonry } from './components/Masonry';
import { Topbar } from './components/Topbar';
import { UploadZone } from './components/UploadZone';

const app = document.querySelector<HTMLDivElement>('#app')!;

if (!isConfigured) {
  app.innerHTML = `
    <div class="config-warning">
      <h1>Almost there</h1>
      <p>This gallery needs Supabase credentials before it can show or accept photos.</p>
      <p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> — see the README for setup steps.</p>
    </div>
  `;
} else {
  bootGallery();
}

function bootGallery(): void {
  let photos: Photo[] = [];
  let ownerId: string | null = null;

  const lightbox = new Lightbox({
    onDelete: async (photo) => {
      await deletePhoto(photo);
      photos = photos.filter((p) => p.id !== photo.id);
      masonry.remove(photo.id);
      lightbox.syncPhotos(photos);
      topbar.setCount(photos.length);
      updateEmptyState();
    },
    onCaptionChange: async (photo, caption) => {
      await updateCaption(photo.id, caption);
      photos = photos.map((p) => (p.id === photo.id ? { ...p, caption: caption || null } : p));
      masonry.updateCaption(photo.id, caption || null);
      lightbox.syncPhotos(photos);
    },
  });

  const masonry = new Masonry((id) => lightbox.open(photos, id));

  const uploadZone = new UploadZone(
    (photo) => addPhoto(photo),
    (message) => showToast(message),
  );

  const topbar = new Topbar(uploadZone.button);

  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';

  app.append(topbar.el, uploadZone.overlayElement, masonry.el, emptyState, lightbox.el);

  function addPhoto(photo: Photo): void {
    if (masonry.has(photo.id)) return;
    photos = [photo, ...photos];
    masonry.prepend(photo);
    topbar.setCount(photos.length);
    updateEmptyState();
  }

  function updateEmptyState(): void {
    emptyState.hidden = photos.length > 0;
    emptyState.textContent = ownerId ? 'No photos yet — drop some in, or use "+ Add Photos".' : 'No photos yet.';
  }

  function showToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    app.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  onAuthChange((session) => {
    ownerId = session?.user.id ?? null;
    topbar.setSession(session?.user.email ?? null);
    uploadZone.setOwner(ownerId);
    lightbox.setOwner(Boolean(ownerId));
    updateEmptyState();
  });

  listPhotos()
    .then((initial) => {
      photos = initial;
      masonry.setPhotos(photos);
      topbar.setCount(photos.length);
      updateEmptyState();
    })
    .catch((err) => showToast(err instanceof Error ? err.message : 'Could not load photos'));

  subscribeToPhotos(
    (photo) => addPhoto(photo),
    (id) => {
      photos = photos.filter((p) => p.id !== id);
      masonry.remove(id);
      lightbox.syncPhotos(photos);
      topbar.setCount(photos.length);
      updateEmptyState();
    },
  );

  if (import.meta.env.DEV) {
    (window as unknown as { __gallery: unknown }).__gallery = {
      masonry,
      lightbox,
      topbar,
      uploadZone,
      addPhoto,
      setOwnerForTesting: (id: string | null) => {
        ownerId = id;
        uploadZone.setOwner(id);
        lightbox.setOwner(Boolean(id));
        updateEmptyState();
      },
    };
  }
}
