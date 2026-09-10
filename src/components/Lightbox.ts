import type { Photo } from '../lib/types';

export interface LightboxCallbacks {
  onDelete: (photo: Photo) => Promise<void>;
  onCaptionChange: (photo: Photo, caption: string) => Promise<void>;
}

export class Lightbox {
  readonly el: HTMLDivElement;

  private readonly imgEl: HTMLImageElement;
  private readonly captionInput: HTMLInputElement;
  private readonly deleteBtn: HTMLButtonElement;
  private readonly prevBtn: HTMLButtonElement;
  private readonly nextBtn: HTMLButtonElement;

  private photos: Photo[] = [];
  private index = -1;
  private isOwner = false;
  private readonly callbacks: LightboxCallbacks;

  constructor(callbacks: LightboxCallbacks) {
    this.callbacks = callbacks;
    this.el = document.createElement('div');
    this.el.className = 'lightbox';
    this.el.hidden = true;
    this.el.innerHTML = `
      <button type="button" class="lightbox__close" aria-label="Close">&times;</button>
      <button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Previous photo">&lsaquo;</button>
      <figure class="lightbox__figure">
        <img class="lightbox__img" alt="" />
      </figure>
      <button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Next photo">&rsaquo;</button>
      <div class="lightbox__footer">
        <input class="lightbox__caption" type="text" placeholder="Add a caption…" maxlength="200" />
        <button type="button" class="lightbox__delete">Delete</button>
      </div>
    `;

    this.imgEl = this.el.querySelector('.lightbox__img')!;
    this.captionInput = this.el.querySelector('.lightbox__caption')!;
    this.deleteBtn = this.el.querySelector('.lightbox__delete')!;
    this.prevBtn = this.el.querySelector('.lightbox__nav--prev')!;
    this.nextBtn = this.el.querySelector('.lightbox__nav--next')!;

    this.el.querySelector('.lightbox__close')!.addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
    this.prevBtn.addEventListener('click', () => this.step(-1));
    this.nextBtn.addEventListener('click', () => this.step(1));
    this.deleteBtn.addEventListener('click', () => void this.handleDelete());
    this.captionInput.addEventListener('change', () => void this.handleCaptionChange());
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  setOwner(isOwner: boolean): void {
    this.isOwner = isOwner;
    this.captionInput.readOnly = !isOwner;
    this.deleteBtn.hidden = !isOwner;
  }

  open(photos: Photo[], id: string): void {
    this.photos = photos;
    this.index = photos.findIndex((p) => p.id === id);
    if (this.index === -1) return;
    this.el.hidden = false;
    this.render();
  }

  close(): void {
    this.el.hidden = true;
  }

  /** Keeps the open lightbox in sync when the underlying photo list changes (delete, caption edit, realtime). */
  syncPhotos(photos: Photo[]): void {
    const previousId = this.current?.id;
    this.photos = photos;
    if (this.el.hidden) return;
    if (photos.length === 0) {
      this.close();
      return;
    }
    const stillAt = previousId ? photos.findIndex((p) => p.id === previousId) : -1;
    this.index = stillAt !== -1 ? stillAt : Math.min(this.index, photos.length - 1);
    this.render();
  }

  private get current(): Photo | undefined {
    return this.photos[this.index];
  }

  private render(): void {
    const photo = this.current;
    if (!photo) {
      this.close();
      return;
    }
    this.imgEl.src = photo.url;
    this.imgEl.alt = photo.caption ?? '';
    this.captionInput.value = photo.caption ?? '';
    const multiple = this.photos.length > 1;
    this.prevBtn.hidden = !multiple;
    this.nextBtn.hidden = !multiple;
  }

  private step(delta: number): void {
    if (this.photos.length === 0) return;
    this.index = (this.index + delta + this.photos.length) % this.photos.length;
    this.render();
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.el.hidden) return;
    const editingCaption = document.activeElement === this.captionInput;
    if (e.key === 'Escape') {
      this.captionInput.blur();
      this.close();
    } else if (!editingCaption && e.key === 'ArrowLeft') {
      this.step(-1);
    } else if (!editingCaption && e.key === 'ArrowRight') {
      this.step(1);
    }
  }

  private async handleDelete(): Promise<void> {
    const photo = this.current;
    if (!photo || !this.isOwner) return;
    if (!confirm('Delete this photo? This can\'t be undone.')) return;
    this.deleteBtn.disabled = true;
    try {
      await this.callbacks.onDelete(photo);
    } finally {
      this.deleteBtn.disabled = false;
    }
  }

  private async handleCaptionChange(): Promise<void> {
    const photo = this.current;
    if (!photo || !this.isOwner) return;
    await this.callbacks.onCaptionChange(photo, this.captionInput.value.trim());
  }
}
