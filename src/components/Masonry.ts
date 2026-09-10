import type { Photo } from '../lib/types';

/** Pinterest-style waterfall grid via CSS columns — no layout library needed. */
export class Masonry {
  readonly el: HTMLDivElement;
  private readonly onOpen: (id: string) => void;
  private cards = new Map<string, HTMLElement>();

  constructor(onOpen: (id: string) => void) {
    this.onOpen = onOpen;
    this.el = document.createElement('div');
    this.el.className = 'masonry';
  }

  get isEmpty(): boolean {
    return this.cards.size === 0;
  }

  has(id: string): boolean {
    return this.cards.has(id);
  }

  setPhotos(photos: Photo[]): void {
    this.el.replaceChildren();
    this.cards.clear();
    for (const photo of photos) {
      const card = this.buildCard(photo);
      this.cards.set(photo.id, card);
      this.el.appendChild(card);
    }
  }

  prepend(photo: Photo): void {
    if (this.cards.has(photo.id)) return;
    const card = this.buildCard(photo);
    this.cards.set(photo.id, card);
    this.el.prepend(card);
  }

  remove(id: string): void {
    this.cards.get(id)?.remove();
    this.cards.delete(id);
  }

  updateCaption(id: string, caption: string | null): void {
    const card = this.cards.get(id);
    if (!card) return;
    let capEl = card.querySelector<HTMLElement>('.masonry__caption');
    if (caption) {
      if (!capEl) {
        capEl = document.createElement('span');
        capEl.className = 'masonry__caption';
        card.appendChild(capEl);
      }
      capEl.textContent = caption;
    } else {
      capEl?.remove();
    }
  }

  private buildCard(photo: Photo): HTMLElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'masonry__card';
    card.style.aspectRatio = `${photo.width} / ${photo.height}`;
    card.addEventListener('click', () => this.onOpen(photo.id));

    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.caption ?? '';
    img.loading = 'lazy';
    img.decoding = 'async';
    card.appendChild(img);

    if (photo.caption) {
      const caption = document.createElement('span');
      caption.className = 'masonry__caption';
      caption.textContent = photo.caption;
      card.appendChild(caption);
    }

    return card;
  }
}
