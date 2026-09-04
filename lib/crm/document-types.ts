export type ClientDocument = {
  id: string;
  organisation_id: string;
  title: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};
