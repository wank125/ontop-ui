const API_BASE = '/api/v1';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

// ── Types ──────────────────────────────────────────────

export interface DataSource {
  id: string;
  name: string;
  jdbc_url: string;
  user: string;
  password: string;
  driver: string;
  created_at: string;
}

export interface BootstrapRequest {
  base_iri?: string;
  output_dir?: string;
  mode?: 'full' | 'partial';
  tables?: string[];
  include_dependencies?: boolean;
  activate_after_generate?: boolean;
}

export interface BootstrapPreview {
  requested_tables: string[];
  resolved_tables: string[];
  added_dependencies: string[];
  warnings: string[];
  estimated_classes: string[];
  estimated_object_properties: Array<{
    from: string;
    name: string;
    to: string;
  }>;
}

export interface BootstrapResult {
  version: string;
  mode: 'full' | 'partial';
  requested_tables: string[];
  resolved_tables: string[];
  added_dependencies: string[];
  ontology_path: string;
  mapping_path: string;
  properties_path: string;
  manifest_path: string;
  selected_tables_path: string;
  output: string;
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

export interface MappingFile {
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

export interface SparqlResults {
  head: { vars: string[] };
  results: { bindings: Array<Record<string, { value: string; type?: string }>> };
}

// ── Data Sources ───────────────────────────────────────

export const datasources = {
  list: () => api<DataSource[]>('/datasources'),
  get: (id: string) => api<DataSource>(`/datasources/${id}`),
  create: (data: { name: string; jdbc_url: string; user: string; password: string; driver: string }) =>
    api<DataSource>('/datasources', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Omit<DataSource, 'id' | 'created_at'>>) =>
    api<DataSource>(`/datasources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    api<void>(`/datasources/${id}`, { method: 'DELETE' }),
  test: (id: string) =>
    api<{ connected: boolean; message: string }>(`/datasources/${id}/test`, { method: 'POST' }),
  schemas: (id: string) =>
    api<{ schemas: string[] }>(`/datasources/${id}/schemas`),
  schema: (id: string, schemaFilter?: string) =>
    api<any>(`/datasources/${id}/schema${schemaFilter ? `?schema_filter=${encodeURIComponent(schemaFilter)}` : ''}`),
  bootstrapPreview: (id: string, data: BootstrapRequest) =>
    api<BootstrapPreview>(`/datasources/${id}/bootstrap-preview`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  bootstrap: (id: string, data: BootstrapRequest) =>
    api<BootstrapResult>(
      `/datasources/${id}/bootstrap`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
};

// ── Mappings ───────────────────────────────────────────

export const mappings = {
  listFiles: () => api<MappingFile[]>('/mappings'),
  getContent: (path: string) =>
    api<MappingContent>(`/mappings/content?path=${encodeURIComponent(path)}`),
  saveContent: (path: string, content: MappingContent) =>
    api<{ success: boolean }>(`/mappings/content?path=${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify(content),
    }),
  validate: (path: string, data?: { ontology_path?: string; properties_path?: string }) =>
    api<{ valid: boolean; errors: string[] }>(`/mappings/validate?path=${encodeURIComponent(path)}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  restartEndpoint: (data?: { ontology_path?: string; mapping_path?: string; properties_path?: string; port?: number }) =>
    api<{ success: boolean; message: string }>('/mappings/restart-endpoint', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
};

// ── SPARQL ─────────────────────────────────────────────

export const sparql = {
  query: (query: string, format = 'json') =>
    api<SparqlResults>('/sparql/query', {
      method: 'POST',
      body: JSON.stringify({ query, format }),
    }),
  reformulate: (query: string) =>
    api<{ sql: string }>('/sparql/reformulate', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  history: () => api<QueryHistoryEntry[]>('/sparql/history'),
  deleteHistory: (id: string) =>
    api<void>(`/sparql/history/${id}`, { method: 'DELETE' }),
  endpointStatus: () =>
    api<{ running: boolean; port: number; ontology_path: string; mapping_path: string; properties_path: string }>('/sparql/endpoint-status'),
};

// ── Ontology (TTL) ────────────────────────────────────

export interface BilingualLabel {
  zh: string;
  en: string;
}

export interface OwlClass {
  name: string;
  local_name: string;
  labels: BilingualLabel;
  comments: BilingualLabel;
  examples: string[];
  domain_tag: string;
}

export interface OwlObjectProperty {
  name: string;
  local_name: string;
  labels: BilingualLabel;
  comments: BilingualLabel;
  domain: string;
  range: string;
  inverse_of: string;
}

export interface OwlDataProperty {
  name: string;
  local_name: string;
  labels: BilingualLabel;
  comments: BilingualLabel;
  domain: string;
  range: string;
}

export interface ShaclPropertyConstraint {
  path: string;
  path_inverse: string;
  min_count: number | null;
  min_inclusive: number | null;
  min_exclusive: number | null;
  datatype: string;
  has_value: string;
  in_values: string[];
}

export interface ShaclSparqlConstraint {
  message: string;
  select: string;
}

export interface ShaclConstraint {
  name: string;
  local_name: string;
  labels: BilingualLabel;
  comments: BilingualLabel;
  target_class: string;
  properties: ShaclPropertyConstraint[];
  sparql_constraints: ShaclSparqlConstraint[];
}

export interface TtlOntology {
  metadata: {
    labels: BilingualLabel;
    comments: BilingualLabel;
    version: string;
    version_iri: string;
  };
  classes: OwlClass[];
  object_properties: OwlObjectProperty[];
  data_properties: OwlDataProperty[];
  shacl_constraints: ShaclConstraint[];
}

export const ontology = {
  listFiles: () => api<MappingFile[]>('/ontology'),
  getContent: (path: string) =>
    api<TtlOntology>(`/ontology/content?path=${encodeURIComponent(path)}`),
};

// ── AI ─────────────────────────────────────────────────

export interface AIStep {
  step: string;
  message?: string;
  sparql?: string;
  sql?: string;
  results?: string;
  answer?: string;
}

export interface AIConfig {
  llm_provider?: string;
  llm_base_url: string;
  llm_api_key: string;
  llm_model: string;
  llm_temperature: number;
  max_tokens: number;
}

export interface QuickQuestion {
  id: string;
  question: string;
}

export interface OntologySummary {
  classes: string[];
  data_properties: string[];
  object_properties: string[];
  prefixes: Record<string, string>;
}

export interface ProviderPreset {
  label: string;
  base_url: string;
  models: string[];
}

export interface ModelDiscoveryResponse {
  provider: string;
  base_url: string;
  models: string[];
  source: 'remote' | 'preset' | 'manual';
  warning?: string | null;
  error?: string;
}

// ── Workbench Types ────────────────────────────────────

export interface ClassCandidate {
  table_name: string;
  class_name: string;
  class_iri: string;
  label: string;
  status: 'accepted' | 'renamed' | 'ignored';
}

export interface DataPropertyCandidate {
  table_name: string;
  column_name: string;
  property_name: string;
  property_iri: string;
  datatype: string;
  is_nullable: boolean;
  is_pk: boolean;
  is_fk: boolean;
  status: 'accepted' | 'renamed' | 'ignored' | 'system';
  is_label?: boolean;
}

export interface ObjectPropertyCandidate {
  from_table: string;
  to_table: string;
  property_name: string;
  property_iri: string;
  fk_columns: string[];
  target_columns?: string[];
  status: 'accepted' | 'renamed' | 'ignored' | 'external';
}

export interface SemanticCandidates {
  candidates: {
    classes: ClassCandidate[];
    data_properties: DataPropertyCandidate[];
    object_properties: ObjectPropertyCandidate[];
  };
}

export const workbench = {
  analyze: (datasourceId: string, tables: string[], baseIri?: string) =>
    api<SemanticCandidates>('/workbench/analyze', {
      method: 'POST',
      body: JSON.stringify({
        datasource_id: datasourceId,
        tables,
        base_iri: baseIri || 'http://example.com/ontop/',
      }),
    }),
  generate: (datasourceId: string, tables: string[], baseIri?: string) =>
    api<BootstrapResult>('/workbench/generate', {
      method: 'POST',
      body: JSON.stringify({
        datasource_id: datasourceId,
        tables,
        base_iri: baseIri || 'http://example.com/ontop/',
      }),
    }),
};

export const ai = {
  ontologySummary: () =>
    api<OntologySummary>('/ai/ontology-summary'),
  streamQuery: async function* (question: string): AsyncGenerator<AIStep> {
    const res = await fetch(`${API_BASE}/ai/query?question=${encodeURIComponent(question)}`);
    if (!res.ok) throw new Error(`AI query failed: ${res.statusText}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            yield JSON.parse(line.slice(6));
          } catch { /* skip malformed */ }
        }
      }
    }
    // flush remaining
    if (buffer.startsWith('data: ')) {
      try { yield JSON.parse(buffer.slice(6)); } catch { /* skip */ }
    }
  },

  // ── AI Config ────────────────────────────────────
  getConfig: () =>
    api<AIConfig>('/ai/config'),
  updateConfig: (data: Partial<AIConfig>) =>
      api<{ success: boolean; message: string }>('/ai/config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  discoverModels: (data: { provider?: string; base_url?: string; api_key?: string }) =>
    api<ModelDiscoveryResponse>('/ai/models', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSystemPrompt: () =>
    api<{ system_prompt: string }>('/ai/system-prompt'),
  updateSystemPrompt: (system_prompt: string) =>
    api<{ success: boolean; message: string }>('/ai/system-prompt', {
      method: 'PUT',
      body: JSON.stringify({ system_prompt }),
    }),
  getQuickQuestions: () =>
    api<{ questions: QuickQuestion[] }>('/ai/quick-questions'),
  updateQuickQuestions: (questions: QuickQuestion[]) =>
    api<{ success: boolean; message: string }>('/ai/quick-questions', {
      method: 'PUT',
      body: JSON.stringify({ questions }),
    }),
};
