import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

// Datasources
export const datasourcesApi = {
  list: () => api.get('/datasources'),
  create: (data: any) => api.post('/datasources', data),
  get: (id: string) => api.get(`/datasources/${id}`),
  update: (id: string, data: any) => api.put(`/datasources/${id}`, data),
  delete: (id: string) => api.delete(`/datasources/${id}`),
  test: (id: string) => api.post(`/datasources/${id}/test`),
  schema: (id: string) => api.get(`/datasources/${id}/schema`),
  bootstrap: (id: string, data: { base_iri?: string; output_dir?: string }) =>
    api.post(`/datasources/${id}/bootstrap`, data),
};

// Mappings
export const mappingsApi = {
  list: () => api.get('/mappings'),
  content: (path: string) => api.get(`/mappings/${path}/content`),
  save: (path: string, data: any) => api.put(`/mappings/${path}/content`, data),
  validate: (path: string, data: any) => api.post(`/mappings/${path}/validate`, data),
  restartEndpoint: (data: any) => api.post('/mappings/restart-endpoint', data),
};

// SPARQL
export const sparqlApi = {
  query: (data: { query: string; format?: string }) =>
    api.post('/sparql/query', data, { responseType: 'text' }),
  reformulate: (query: string) => api.post('/sparql/reformulate', { query }),
  history: () => api.get('/sparql/history'),
  deleteHistory: (id: string) => api.delete(`/sparql/history/${id}`),
  endpointStatus: () => api.get('/sparql/endpoint-status'),
};

// AI
export const aiApi = {
  ontologySummary: () => api.get('/ai/ontology-summary'),
  queryUrl: (question: string) => `/api/v1/ai/query?question=${encodeURIComponent(question)}`,
};

// Config
export const configApi = {
  health: () => api.get('/health'),
  get: () => api.get('/config'),
};

export default api;
