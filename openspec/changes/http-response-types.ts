export interface ResolverResult {
  shape: string;
  body: unknown;
}

export interface HttpResponsePointer {
  type: 'httpResponse';
  url: string;
  max_bytes?: number;
  allow_domains?: string[];
}
