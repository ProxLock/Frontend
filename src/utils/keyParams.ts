/**
 * Utility functions for parsing and building key creation URL parameters
 */

export interface KeyParams {
  name: string;
  key: string;
  allowsWeb: boolean;
  whitelistedUrls: string[];
  rateLimit: number;
}

/**
 * Parse key creation parameters from URL search params
 */
export function parseKeyParams(searchParams: URLSearchParams): KeyParams {
  const keyName = searchParams.get("name") || "";
  const keyValue = searchParams.get("key") || "";
  const allowsWeb = searchParams.get("allowsWeb") === "true";
  const whitelistedUrlsParam = searchParams.get("whitelistedUrls") || "";
  const whitelistedUrls = whitelistedUrlsParam
    ? whitelistedUrlsParam.split(",").map(url => url.trim()).filter(url => url.length > 0)
    : [];
  const rateLimitParam = searchParams.get("rateLimit");
  const rateLimit = rateLimitParam ? parseInt(rateLimitParam, 10) : -1;

  return {
    name: keyName,
    key: keyValue,
    allowsWeb,
    whitelistedUrls,
    rateLimit: isNaN(rateLimit) ? -1 : rateLimit,
  };
}

/**
 * Build URL search params from key creation parameters
 */
export function buildKeyParamsUrl(params: Partial<KeyParams>, includeOpenModal: boolean = true): string {
  const searchParams = new URLSearchParams();
  
  if (params.name) searchParams.set("name", params.name);
  if (params.key) searchParams.set("key", params.key);
  if (params.allowsWeb) searchParams.set("allowsWeb", "true");
  if (params.whitelistedUrls && params.whitelistedUrls.length > 0) {
    searchParams.set("whitelistedUrls", params.whitelistedUrls.join(","));
  }
  if (params.rateLimit !== undefined && params.rateLimit !== -1) {
    searchParams.set("rateLimit", params.rateLimit.toString());
  }
  if (includeOpenModal) {
    searchParams.set("openModal", "true");
  }
  
  return searchParams.toString();
}
