import { describe, it, expect, vi } from "vitest";
import { isAlwaysBlockedDomain } from "../lib/safe-fetch";
import { getCareersPagePriority, checkCareersMatch } from "../lib/checks/careers-match";
import { checkComplaints } from "../lib/checks/complaints";
import { selectCandidatePages } from "../lib/checks/candidate-pages";
import {
  getRegistryPriority,
  matchesLegalName,
  extractCandidateLegalName,
  checkRegistration,
} from "../lib/checks/registration";
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

  describe("Registration Registry Ranking and Snippet Corroboration", () => {
    it("ranks mca.gov.in highest, zaubacorp/thecompanycheck/vakilsearch second, and aggregators last", () => {
      expect(getRegistryPriority("https://www.mca.gov.in/content/mca/global/en/home.html")).toBe(1);
      expect(getRegistryPriority("https://www.zaubacorp.com/company/TCS/L22210MH1995PLC084781")).toBe(2);
      expect(getRegistryPriority("https://www.thecompanycheck.com/company/tcs/L22210MH1995PLC084781")).toBe(2);
      expect(getRegistryPriority("https://vakilsearch.com/company/tcs-cin-L22210MH1995PLC084781")).toBe(2);
      expect(getRegistryPriority("https://www.tofler.in/company/tcs")).toBe(3);
      expect(getRegistryPriority("https://example.com/corporate-info")).toBe(10);
      expect(getRegistryPriority("https://www.naukri.com/company-info")).toBe(99);
    });

    it("matches legal names stripping corporate suffixes", () => {
      expect(
        matchesLegalName(
          "TATA CONSULTANCY SERVICES LIMITED is a registered Public limited company",
          "Tata Consultancy Services"
        )
      ).toBe(true);
      expect(
        matchesLegalName(
          "INFOSYS LIMITED - CIN L85110KA1981PLC013115",
          "Infosys Ltd"
        )
      ).toBe(true);
      expect(
        matchesLegalName(
          "Acme Technologies Private Limited, ROC Bangalore",
          "Acme Technologies Pvt Ltd"
        )
      ).toBe(true);
      expect(
        matchesLegalName(
          "Unrelated Random Company Ltd",
          "Tata Consultancy Services"
        )
      ).toBe(false);
    });

    it("extracts candidate legal name from title segment", () => {
      const legal = extractCandidateLegalName(
        "TATA CONSULTANCY SERVICES LIMITED - Company Details | Zauba Corp",
        "Tata Consultancy Services"
      );
      expect(legal).toBe("TATA CONSULTANCY SERVICES LIMITED");
    });

    it("corroborates Indian registration directly from snippet CIN and exact legal name without page fetch", async () => {
      const searchSpy = vi.spyOn(serpapi, "searchGoogleWithSerpApi").mockResolvedValueOnce([
        {
          title: "TATA CONSULTANCY SERVICES LIMITED - Zauba Corp",
          link: "https://www.zaubacorp.com/company/TATA-CONSULTANCY-SERVICES-LIMITED/L22210MH1995PLC084781",
          snippet:
            "TATA CONSULTANCY SERVICES LIMITED is a Public limited company. Its Corporate Identification Number is (CIN) L22210MH1995PLC084781.",
        },
      ]);

      const claims: ExtractedClaims = {
        companyName: "Tata Consultancy Services",
        role: "Software Developer",
        salary: null,
        location: "Mumbai, India",
        contacts: [],
        links: [],
        employerDomain: "tcs.com",
        claimedOperatingYears: null,
        feeClaims: [],
      };

      const result = await checkRegistration(claims);
      expect(searchSpy).toHaveBeenCalled();
      expect(result.status).toBe("completed");
      expect(result.facts.identityMatch).toBe("high");
      expect(result.facts.cin).toBe("L22210MH1995PLC084781");
      expect(result.facts.legalName).toBe("TATA CONSULTANCY SERVICES LIMITED");
      expect(result.evidence.some((e) => e.classification === "corroboration")).toBe(true);
      expect(result.finding).toContain("L22210MH1995PLC084781");

      searchSpy.mockRestore();
    });

    it("corroborates from MCA snippet even when MCA blocks direct fetch", async () => {
      const searchSpy = vi.spyOn(serpapi, "searchGoogleWithSerpApi").mockResolvedValueOnce([
        {
          title: "Company Master Data - Ministry of Corporate Affairs",
          link: "https://www.mca.gov.in/mcafoportal/companyMasterData.do",
          snippet:
            "INFOSYS LIMITED, CIN: L85110KA1981PLC013115, Company Status: Active, ROC Bangalore.",
        },
      ]);

      const claims: ExtractedClaims = {
        companyName: "Infosys",
        role: "Systems Engineer",
        salary: null,
        location: "Bengaluru, India",
        contacts: [],
        links: [],
        employerDomain: "infosys.com",
        claimedOperatingYears: null,
        feeClaims: [],
      };

      const result = await checkRegistration(claims);
      expect(result.status).toBe("completed");
      expect(result.facts.identityMatch).toBe("high");
      expect(result.facts.cin).toBe("L85110KA1981PLC013115");
      expect(result.evidence.some((e) => e.classification === "corroboration")).toBe(true);

      searchSpy.mockRestore();
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

      await checkRegistration({ ...claimsWithDomain, location: "Bengaluru, India" });
      expect(queryRun).toBe('"Google" private limited CIN registration');
      expect(timeoutRun).toBe(7000);

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
});
