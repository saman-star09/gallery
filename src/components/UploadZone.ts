import { uploadPhoto } from '../lib/photos';
import type { Photo } from '../lib/types';

/** The "Add Photos" button plus a full-page drag-and-drop overlay. Both are inert until an owner id is set. */
export class UploadZone {
  readonly button: HTMLButtonElement;
  readonly overlayElement: HTMLDivElement;

  private readonly fileInput: HTMLInputElement;
  private readonly onUploaded: (photo: Photo) => void;
  private readonly onError: (message: string) => void;
  private ownerId: string | null = null;
  private dragDepth = 0;

  constructor(onUploaded: (photo: Photo) => void, onError: (message: string) => void) {
    this.onUploaded = onUploaded;
    this.onError = onError;
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'topbar__add';
    this.button.textContent = '+ Add Photos';
    this.button.hidden = true;
    this.button.addEventListener('click', () => this.fileInput.click());

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.multiple = true;
    this.fileInput.hidden = true;
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files?.length) void this.handleFiles(this.fileInput.files);
      this.fileInput.value = '';
    });
    document.body.appendChild(this.fileInput);

    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'drop-overlay';
    this.overlayElement.hidden = true;
    this.overlayElement.textContent = 'Drop photos to add them';

    this.bindDragAndDrop();
  }

  setOwner(ownerId: string | null): void {
    this.ownerId = ownerId;
    this.button.hidden = !ownerId;
  }

  private bindDragAndDrop(): void {
    window.addEventListener('dragenter', (e) => {
      if (!this.ownerId || !hasFiles(e)) return;
      e.preventDefault();
      this.dragDepth++;
      this.overlayElement.hidden = false;
    });
    window.addEventListener('dragover', (e) => {
      if (!this.ownerId || !hasFiles(e)) return;
      e.preventDefault();
    });
    window.addEventListener('dragleave', () => {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      if (this.dragDepth === 0) this.overlayElement.hidden = true;
    });
    window.addEventListener('drop', (e) => {
      if (!this.ownerId) return;
      e.preventDefault();
      this.dragDepth = 0;
      this.overlayElement.hidden = true;
      if (e.dataTransfer?.files.length) void this.handleFiles(e.dataTransfer.files);
    });
  }

  private async handleFiles(fileList: FileList): Promise<void> {
    if (!this.ownerId) return;
    const ownerId = this.ownerId;
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    for (const file of files) {
      try {
        const photo = await uploadPhoto(file, ownerId);
        this.onUploaded(photo);
      } catch (err) {
        this.onError(err instanceof Error ? err.message : `Couldn't upload ${file.name}`);
      }
    }
  }
}

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}
