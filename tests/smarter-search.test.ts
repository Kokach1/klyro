import { describe, it, expect, vi } from "vitest";
import { isAlwaysBlockedDomain } from "../lib/safe-fetch";
import { getCareersPagePriority, checkCareersMatch } from "../lib/checks/careers-match";
import { checkComplaints } from "../lib/checks/complaints";
import { selectCandidatePages } from "../lib/checks/candidate-pages";
import * as candidatePages from "../lib/checks/candidate-pages";
import * as serpapi from "../lib/providers/serpapi";
import { ExtractedClaims } from "../lib/contracts";

describe("Smarter Careers and Registry Search", () => {
  describe("Skip-List Domains", () => {
    it("flags domains known to always block servers", () => {
      expect(isAlwaysBlockedDomain("https://www.linkedin.com/jobs/view/123")).toBe(true);
      expect(isAlwaysBlockedDomain("https://www.glassdoor.co.in/Job/index.htm")).toBe(true);
      expect(isAlwaysBlockedDomain("https://in.indeed.com/viewjob?jk=123")).toBe(true);
      expect(isAlwaysBlockedDomain("https://www.shine.com/jobs/123")).toBe(true);
      expect(isAlwaysBlockedDomain("https://www.naukri.com/job-listings-123")).toBe(true);
      expect(isAlwaysBlockedDomain("https://www.foundit.in/job/123")).toBe(true);
      expect(isAlwaysBlockedDomain("https://www.ambitionbox.com/jobs/123")).toBe(true);
    });

    it("allows employer domains and ATS portals through", () => {
      expect(isAlwaysBlockedDomain("https://careers.google.com")).toBe(false);
      expect(isAlwaysBlockedDomain("https://jobs.lever.co/stripe")).toBe(false);
      expect(isAlwaysBlockedDomain("https://boards.greenhouse.io/airbnb")).toBe(false);
      expect(isAlwaysBlockedDomain("https://stripe.myworkdayjobs.com/stripe")).toBe(false);
      expect(isAlwaysBlockedDomain("https://acme.keka.com/careers")).toBe(false);
      expect(isAlwaysBlockedDomain("https://infopark.in/jobs/company/role")).toBe(false);
    });
  });

  describe("Careers Candidate Prioritization", () => {
    it("ranks employer domain first, ATS portals second, other third, and blocked aggregators last", () => {
      const employerDomain = "acmecorp.com";

      const pEmployer = getCareersPagePriority("https://acmecorp.com/careers/engineer", employerDomain);
      const pLever = getCareersPagePriority("https://jobs.lever.co/acmecorp/123", employerDomain);
      const pGreenhouse = getCareersPagePriority("https://boards.greenhouse.io/acmecorp", employerDomain);
      const pWorkday = getCareersPagePriority("https://acmecorp.myworkdayjobs.com/en-US/careers", employerDomain);
      const pKeka = getCareersPagePriority("https://acmecorp.keka.com/careers", employerDomain);
      const pGeneral = getCareersPagePriority("https://techblog.com/hiring-acmecorp", employerDomain);
      const pBlockedNaukri = getCareersPagePriority("https://www.naukri.com/job-listings", employerDomain);
      const pBlockedLinkedIn = getCareersPagePriority("https://www.linkedin.com/jobs/view/1", employerDomain);

      expect(pEmployer).toBe(1);
      expect(pLever).toBe(2);
      expect(pGreenhouse).toBe(2);
      expect(pWorkday).toBe(2);
      expect(pKeka).toBe(2);
      expect(pGeneral).toBe(3);
      expect(pBlockedNaukri).toBe(4);
      expect(pBlockedLinkedIn).toBe(4);

      expect(pEmployer).toBeLessThan(pLever);
      expect(pLever).toBeLessThan(pGeneral);
      expect(pGeneral).toBeLessThan(pBlockedNaukri);
    });
  });

  describe("Careers Query Construction", () => {
    it("constructs quoted, company-derived queries for every SerpAPI check", async () => {
      let queryRun = "";
      let timeoutRun = 0;
      const searchSpy = vi.spyOn(serpapi, "searchGoogleWithSerpApi").mockImplementation(async (q, timeout) => {
        queryRun = q;
        timeoutRun = timeout ?? 0;
        return [];
      });

      const claimsWithDomain: ExtractedClaims = {
        companyName: "Google",
        role: "Software Engineer",
        salary: null,
        location: "Mountain View, CA",
        contacts: [],
        links: [],
        employerDomain: "google.com",
        claimedOperatingYears: null,
        feeClaims: [],
      };

      await checkCareersMatch(claimsWithDomain);
      expect(queryRun).toBe('"Google" careers');
      expect(timeoutRun).toBe(7000);

      const claimsWithoutDomain: ExtractedClaims = {
        companyName: "Google",
        role: "Software Engineer",
        salary: null,
        location: "Mountain View, CA",
        contacts: [],
        links: [],
        employerDomain: null,
        claimedOperatingYears: null,
        feeClaims: [],
      };

      await checkCareersMatch(claimsWithoutDomain);
      expect(queryRun).toBe('"Google" careers');

      await checkComplaints(claimsWithDomain);
      expect(queryRun).toBe('"Google" scam OR complaint OR review');
      expect(timeoutRun).toBe(7000);

      searchSpy.mockRestore();
    });

    it("keeps at most three fetchable candidates and retains Infopark jobs", () => {
      const candidates = selectCandidatePages([
        { title: "Blocked", link: "https://www.linkedin.com/jobs/1" },
        { title: "Infopark", link: "https://infopark.in/jobs/1" },
        { title: "One", link: "https://example.com/1" },
        { title: "Two", link: "https://example.org/2" },
        { title: "Three", link: "https://example.net/3" },
      ]);

      expect(candidates.map((candidate) => candidate.link)).toEqual([
        "https://infopark.in/jobs/1",
        "https://example.com/1",
        "https://example.org/2",
      ]);
    });

    it("returns inconclusive when every careers lead is filtered out", async () => {
      const searchSpy = vi.spyOn(serpapi, "searchGoogleWithSerpApi").mockResolvedValueOnce([
        {
          title: "Google jobs on LinkedIn",
          link: "https://www.linkedin.com/jobs/view/123",
          snippet: "Google is hiring Software Engineers.",
        },
      ]);

      const result = await checkCareersMatch({
        companyName: "Google",
        role: "Software Engineer",
        salary: null,
        location: "Bengaluru, India",
        contacts: [],
        links: [],
        employerDomain: "google.com",
        claimedOperatingYears: null,
        feeClaims: [],
      });

      expect(result.status).toBe("inconclusive");
      expect(result.reasonCode).toBe("blocked_page");
      searchSpy.mockRestore();
    });
  });

  describe("Evidence Tiers (Verified, Corroborated, Inconclusive)", () => {
    it("careers: returns verified tier when employer careers page is directly read", async () => {
      const searchSpy = vi.spyOn(serpapi, "searchGoogleWithSerpApi").mockResolvedValueOnce([
        {
          title: "Software Engineer at Acme Corp",
          link: "https://acmecorp.com/careers/software-engineer",
          snippet: "Apply for Software Engineer role at Acme Corp.",
        },
      ]);
      const fetchSpy = vi.spyOn(candidatePages, "fetchCandidatePages").mockResolvedValueOnce([
        {
          item: {
            title: "Software Engineer at Acme Corp",
            link: "https://acmecorp.com/careers/software-engineer",
            snippet: "Apply for Software Engineer role at Acme Corp.",
          },
          page: {
            url: "https://acmecorp.com/careers/software-engineer",
            finalUrl: "https://acmecorp.com/careers/software-engineer",
            text: "Acme Corp is hiring a full-time Software Engineer. Competitive salary.",
            statusCode: 200,
            contentLength: 72,
          },
        },
      ]);

      const result = await checkCareersMatch({
        companyName: "Acme Corp",
        role: "Software Engineer",
        salary: null,
        location: "Bengaluru, India",
        contacts: [],
        links: [],
        employerDomain: "acmecorp.com",
        claimedOperatingYears: null,
        feeClaims: [],
      });

      expect(result.status).toBe("completed");
      expect(result.tier).toBe("verified");
      expect(result.facts.roleMatched).toBe(true);
      expect(result.finding).toContain("Verified matching job posting found on official careers portal");

      searchSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it("careers: falls back to corroborated search tier when employer page fetch fails/blocked", async () => {
      const searchSpy = vi.spyOn(serpapi, "searchGoogleWithSerpApi").mockResolvedValueOnce([
        {
          title: "Acme Corp - Careers - Software Engineer",
          link: "https://acmecorp.com/careers/software-engineer",
          snippet: "Acme Corp is seeking a Software Engineer to join our platform team.",
        },
      ]);
      // Simulate page fetch blocked/failed
      const fetchSpy = vi.spyOn(candidatePages, "fetchCandidatePages").mockResolvedValueOnce([
        {
          item: {
            title: "Acme Corp - Careers - Software Engineer",
            link: "https://acmecorp.com/careers/software-engineer",
            snippet: "Acme Corp is seeking a Software Engineer to join our platform team.",
          },
          page: null,
        },
      ]);

      const result = await checkCareersMatch({
        companyName: "Acme Corp",
        role: "Software Engineer",
        salary: null,
        location: "Bengaluru, India",
        contacts: [],
        links: [],
        employerDomain: "acmecorp.com",
        claimedOperatingYears: null,
        feeClaims: [],
      });

      expect(result.status).toBe("completed");
      expect(result.tier).toBe("corroborated");
      expect(result.finding).toBe("Listing found via search (page not directly read)");
      expect(result.facts.roleMatched).toBe(true);

      searchSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it("careers: corroborates listing from infopark.in/jobs search snippet naming company and role", async () => {
      const searchSpy = vi.spyOn(serpapi, "searchGoogleWithSerpApi").mockResolvedValueOnce([
        {
          title: "Software Engineer at TechKerala - Infopark Jobs",
          link: "https://infopark.in/jobs/techkerala/software-engineer",
          snippet: "TechKerala is hiring a Software Engineer at Infopark Kochi.",
        },
      ]);
      // Page fetch blocked/fails
      const fetchSpy = vi.spyOn(candidatePages, "fetchCandidatePages").mockResolvedValueOnce([
        {
          item: {
            title: "Software Engineer at TechKerala - Infopark Jobs",
            link: "https://infopark.in/jobs/techkerala/software-engineer",
            snippet: "TechKerala is hiring a Software Engineer at Infopark Kochi.",
          },
          page: null,
        },
      ]);

      const result = await checkCareersMatch({
        companyName: "TechKerala",
        role: "Software Engineer",
        salary: null,
        location: "Kochi, Kerala",
        contacts: [],
        links: [],
        employerDomain: "techkerala.com",
        claimedOperatingYears: null,
        feeClaims: [],
      });

      expect(result.status).toBe("completed");
      expect(result.tier).toBe("corroborated");
      expect(result.finding).toBe("Listing found via search (page not directly read)");
      expect(result.facts.roleMatched).toBe(true);

      searchSpy.mockRestore();
      fetchSpy.mockRestore();
    });
  });
});
