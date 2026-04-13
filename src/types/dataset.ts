export interface Dataset {
  id: string;
  name: string;
  sampleDesc: string;
  instrument: string;
  submitTime: string; // ISO string format preferred
  submitter: string;
  institution: string;
  status: 'Processing' | 'Queued' | 'Finished';
  isPublic: boolean;
  thumbnailUrl: string;
  // Size in bytes (optional) - mapped from backend size/file_size fields
  sizeBytes?: number;
}
