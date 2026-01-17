export interface Project {
  id?: string;
  name?: string;
  description: string;
  keys?: unknown[];
}

export interface UserAccessKey {
  key: string;
  name: string;
}
