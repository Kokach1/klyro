import { getServerEnv } from "../env";

export interface WhoisRecordData {
  createdDateRaw: string | null;
  registryCreatedDateRaw: string | null;
  registrantMasked: boolean;
  rawResponse: any;
}

export class WhoisXmlError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "WhoisXmlError";
  }
}

/**
 * Fetch WHOIS records from WhoisXML API:
 * POST https://www.whoisxmlapi.com/whoisserver/WhoisService
 * JSON apiKey, domainName, outputFormat: "JSON"
 */
export async function fetchWhoisData(
  domainName: string,
  timeoutMs = 15000
): Promise<WhoisRecordData> {
  const env = getServerEnv();
  const apiKey = env.WHOISXML_API_KEY;

  if (!apiKey) {
    throw new WhoisXmlError("WHOISXML_API_KEY is not configured.", "missing_key");
  }

  const endpoint = "https://www.whoisxmlapi.com/whoisserver/WhoisService";

  const payload = {
    apiKey,
    domainName,
    outputFormat: "JSON",
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
      throw new WhoisXmlError("WhoisXML request timed out.", "timeout");
    }
    throw new WhoisXmlError(`Network error querying WhoisXML: ${err.message}`, "provider_error");
  }

  if (response.status === 401 || response.status === 403) {
    throw new WhoisXmlError("WhoisXML authentication failed (invalid key).", "missing_key");
  }

  if (response.status === 429) {
    throw new WhoisXmlError("WhoisXML rate limit or quota exceeded.", "quota");
  }

  let data: any;
  try {
    data = await response.json();
  } catch (err: any) {
    throw new WhoisXmlError("Malformed JSON response from WhoisXML.", "provider_error");
  }

  if (data.ErrorMessage) {
    const msg = data.ErrorMessage.msg || JSON.stringify(data.ErrorMessage);
    if (msg.includes("credit") || msg.includes("quota") || msg.includes("balance")) {
      throw new WhoisXmlError(`WhoisXML quota exceeded: ${msg}`, "quota");
    }
    throw new WhoisXmlError(`WhoisXML error: ${msg}`, "provider_error");
  }

  const whoisRecord = data.WhoisRecord;
  if (!whoisRecord) {
    throw new WhoisXmlError("Missing WhoisRecord in WhoisXML response.", "missing_data");
  }

  // Parse creation date: Prefer top-level createdDate; fallback to registryData.createdDate
  // Never use updated, expires, or audit dates
  const createdDateRaw = whoisRecord.createdDate || whoisRecord.createdDateNormalized || null;
  const registryCreatedDateRaw =
    whoisRecord.registryData?.createdDate ||
    whoisRecord.registryData?.createdDateNormalized ||
    null;

  // Check privacy masking (separate from missing date)
  const registrant = whoisRecord.registrant || {};
  const registrantOrg = (registrant.organization || "").toLowerCase();
  const registrantName = (registrant.name || "").toLowerCase();
  const registrantMasked =
    registrantOrg.includes("privacy") ||
    registrantOrg.includes("proxy") ||
    registrantOrg.includes("whoisguard") ||
    registrantOrg.includes("redacted") ||
    registrantOrg.includes("masked") ||
    registrantName.includes("privacy") ||
    registrantName.includes("redacted") ||
    registrantName.includes("masked");

  return {
    createdDateRaw,
    registryCreatedDateRaw,
    registrantMasked,
    rawResponse: data,
  };
}
