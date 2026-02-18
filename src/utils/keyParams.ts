/**
 * Utility functions for parsing and building key creation URL parameters
 */

export interface KeyParams {
  name: string;
  key: string;
  description: string;
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
  const description = searchParams.get("description") || "";
  const allowsWeb = searchParams.get("allowsWeb") === "true";
  const whitelistedUrlsParam = searchParams.get("whitelistedUrls") || "";
  const whitelistedUrls = whitelistedUrlsParam
    ? whitelistedUrlsParam.split(",").map(url => {
        let cleanUrl = url.trim();
        // Remove protocol if present
        cleanUrl = cleanUrl.replace(/^https?:\/\//i, "");
        // Remove leading slashes
        cleanUrl = cleanUrl.replace(/^\/+/, "");
        return cleanUrl;
      }).filter(url => url.length > 0)
    : [];
  const rateLimitParam = searchParams.get("rateLimit");
  const rateLimit = rateLimitParam ? parseInt(rateLimitParam, 10) : -1;

  return {
    name: keyName,
    key: keyValue,
    description,
    allowsWeb,
    whitelistedUrls,
    // Rate limit must be >= 1 or -1 for unlimited
    rateLimit: isNaN(rateLimit) || rateLimit < 1 ? -1 : rateLimit,
  };
}

/**
 * Build URL search params from key creation parameters
 */
export function buildKeyParamsUrl(params: Partial<KeyParams>, includeOpenModal: boolean = true): string {
  const searchParams = new URLSearchParams();
  
  if (params.name) searchParams.set("name", params.name);
  if (params.key) searchParams.set("key", params.key);
  if (params.description) searchParams.set("description", params.description);
  if (params.allowsWeb) searchParams.set("allowsWeb", "true");
  if (params.whitelistedUrls && params.whitelistedUrls.length > 0) {
    searchParams.set("whitelistedUrls", params.whitelistedUrls.join(","));
  }
  // Only include rateLimit if it's >= 1 (not -1/unlimited and not 0)
  if (params.rateLimit !== undefined && params.rateLimit >= 1) {
    searchParams.set("rateLimit", params.rateLimit.toString());
  }
  if (includeOpenModal) {
    searchParams.set("openModal", "true");
  }
  
  return searchParams.toString();
}
