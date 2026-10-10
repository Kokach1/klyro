export function buildCompanySearchQuery(companyName: string, terms: string): string {
  const safeCompanyName = companyName.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
  return `"${safeCompanyName}" ${terms}`;
}
