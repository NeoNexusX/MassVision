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
  // Additional fields based on requirements or future expansion
  species?: string;
  description?: string;
}
