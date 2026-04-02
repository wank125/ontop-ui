export interface DataSource {
  id: string;
  name: string;
  jdbc_url: string;
  user: string;
  driver: string;
  created_at: string;
}

export interface DataSourceForm {
  name: string;
  jdbc_url: string;
  user: string;
  password: string;
  driver: string;
}

export interface MappingRule {
  mapping_id: string;
  target: string;
  source: string;
}

export interface MappingContent {
  prefixes: Record<string, string>;
  mappings: MappingRule[];
}

export interface MappingFileInfo {
  path: string;
  filename: string;
  modified_at?: number;
}

export interface QueryHistoryEntry {
  id: string;
  query: string;
  timestamp: string;
  result_count?: number;
}

export interface EndpointStatus {
  running: boolean;
  port: number;
}
