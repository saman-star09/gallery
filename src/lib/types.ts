export interface Photo {
  id: string;
  storagePath: string;
  url: string;
  width: number;
  height: number;
  caption: string | null;
  createdAt: string;
  ownerId: string;
}
