import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithJinaReader, JINA_READER_BASE_URL } from "../lib/providers/jina";
import { checkCareersMatch } from "../lib/checks/careers-match";
import * as candidatePages from "../lib/checks/candidate-pages";
import * as serpapi from "../lib/providers/serpapi";
import { ExtractedClaims } from "../lib/contracts";

describe("Jina Reader Page Reads & Outcome Tiers", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.JINA_API_KEY;
  });

  describe("fetchWithJinaReader", () => {
    it("routes outbound URL through https://r.jina.ai/ + target URL", async () => {
      let requestedUrl = "";
      let requestedHeaders: Record<string, string> = {};

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        requestedUrl = url;
        requestedHeaders = (init?.headers as Record<string, string>) || {};
        return {
          ok: true,
          status: 200,
          text: async () => "Job Title: Software Engineer at Acme Corp. Apply now.",
        } as Response;
      });

      const result = await fetchWithJinaReader("https://acmecorp.com/careers/engineer");

      expect(requestedUrl).toBe("https://r.jina.ai/https://acmecorp.com/careers/engineer");
      expect(result).not.toBeNull();
      expect(result?.url).toBe("https://acmecorp.com/careers/engineer");
      expect(result?.text).toContain("Job Title: Software Engineer at Acme Corp");
      expect(requestedHeaders["Authorization"]).toBeUndefined();
    });

    it("attaches Authorization Bearer token when JINA_API_KEY is configured", async () => {
      process.env.JINA_API_KEY = "jina_secret_key_12345";
      let authHeader: string | undefined = undefined;

      global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        const headers = (init?.headers as Record<string, string>) || {};
        authHeader = headers["Authorization"];
        return {
          ok: true,
          status: 200,
          text: async () => "Page content from authorized Jina reader request.",
        } as Response;
      });

      const result = await fetchWithJinaReader("https://example.com/job");

      expect(authHeader).toBe("Bearer jina_secret_key_12345");
      expect(result?.text).toContain("Page content");
    });

    it("sanitizes untrusted HTML and clamps output according to maxTextChars", async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          text: async () =>
            "<html><body><script>alert(1)</script><h1>Hiring Lead</h1><p>Description here</p></body></html>",
        } as Response;
      });

      const result = await fetchWithJinaReader("https://acme.com/job", { maxTextChars: 20 });

      expect(result?.text).not.toContain("<script>");
      expect(result?.text).not.toContain("alert(1)");
      expect(result?.text.length).toBeLessThanOrEqual(20);
    });

    it("handles rate limiting (429) or upstream errors by returning null", async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 429,
          text: async () => "Rate limit exceeded",
        } as Response;
      });

      const result = await fetchWithJinaReader("https://example.com/job");
      expect(result).toBeNull();
    });
  });

  describe("Careers Verification Tiers (Employer Own Page vs Aggregator)", () => {
    const claims: ExtractedClaims = {
      companyName: "Acme Corp",
      role: "Platform Engineer",
      salary: null,
      location: "Bengaluru, India",
      contacts: [],
      links: [],
      employerDomain: "acmecorp.com",
      claimedOperatingYears: null,
      feeClaims: [],
    };

    it("counts successful Jina read of the employer's OWN page as verified tier", async () => {
      const searchSpy = vi.spyOn(serpapi, "searchGoogleWithSerpApi").mockResolvedValueOnce([
        {
          title: "Platform Engineer at Acme Corp",
          link: "https://acmecorp.com/careers/platform-engineer",
          snippet: "Join our platform team at Acme Corp.",
        },
      ]);

      const fetchSpy = vi.spyOn(candidatePages, "fetchCandidatePages").mockResolvedValueOnce([
        {
          item: {
            title: "Platform Engineer at Acme Corp",
            link: "https://acmecorp.com/careers/platform-engineer",
            snippet: "Join our platform team at Acme Corp.",
          },
          page: {
            url: "https://acmecorp.com/careers/platform-engineer",
            finalUrl: "https://acmecorp.com/careers/platform-engineer",
            statusCode: 200,
            text: "Acme Corp is hiring a Platform Engineer. Location: Bengaluru.",
            contentLength: 60,
          },
        },
      ]);

      const result = await checkCareersMatch(claims);

      expect(result.status).toBe("completed");
      expect(result.tier).toBe("verified");
      expect(result.facts.roleMatched).toBe(true);
      expect(result.facts.domainOfficialConfirmed).toBe(true);
      expect(result.finding).toContain("Verified matching job posting found on official careers portal");

      searchSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it("counts successful Jina read of an aggregator page as corroborated tier", async () => {
      const searchSpy = vi.spyOn(serpapi, "searchGoogleWithSerpApi").mockResolvedValueOnce([
        {
          title: "Platform Engineer at Acme Corp - TechJobAggregator",
          link: "https://techjobaggregator.org/jobs/acme-corp/platform-engineer",
          snippet: "Acme Corp listing on TechJobAggregator.",
        },
      ]);

      // Jina Reader reads the aggregator page successfully
      const fetchSpy = vi.spyOn(candidatePages, "fetchCandidatePages").mockResolvedValueOnce([
        {
          item: {
            title: "Platform Engineer at Acme Corp - TechJobAggregator",
            link: "https://techjobaggregator.org/jobs/acme-corp/platform-engineer",
            snippet: "Acme Corp listing on TechJobAggregator.",
          },
          page: {
            url: "https://techjobaggregator.org/jobs/acme-corp/platform-engineer",
            finalUrl: "https://techjobaggregator.org/jobs/acme-corp/platform-engineer",
            statusCode: 200,
            text: "TechJobAggregator Listing: Acme Corp is looking for a Platform Engineer.",
            contentLength: 75,
          },
        },
      ]);

      const result = await checkCareersMatch(claims);

      expect(result.status).toBe("completed");
      expect(result.tier).toBe("corroborated");
      expect(result.facts.roleMatched).toBe(true);
      expect(result.facts.domainOfficialConfirmed).toBe(false);
      expect(result.finding).toBe("Listing found via search (page not directly read)");

      searchSpy.mockRestore();
      fetchSpy.mockRestore();
    });
  });
});
