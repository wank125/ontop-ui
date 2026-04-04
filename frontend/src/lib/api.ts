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
  schema: (id: string) =>
    api<any>(`/datasources/${id}/schema`),
  bootstrap: (id: string, data: { base_iri?: string; output_dir?: string }) =>
    api<{ ontology_path: string; mapping_path: string; properties_path: string; output: string }>(
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
    api<{ running: boolean; port: number }>('/sparql/endpoint-status'),
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

export const ai = {
  ontologySummary: () =>
    api<{ classes: string[]; data_properties: string[]; object_properties: string[]; prefixes: Record<string, string> }>(
      '/ai/ontology-summary',
    ),
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
};
