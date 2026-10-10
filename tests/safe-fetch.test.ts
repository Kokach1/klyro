import { describe, it, expect } from "vitest";
import {
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
  isPublicIP,
  validateUrl,
  extractEmployerRegistrableDomain,
  sanitizeHtmlToText,
  SafeFetchError,
  BROWSER_USER_AGENT,
} from "../lib/safe-fetch";

describe("Safe Fetch - IP & URL Security", () => {
  it("rejects private, loopback, link-local and reserved IPv4 addresses", () => {
    expect(isPrivateOrReservedIPv4("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIPv4("127.0.0.2")).toBe(true);
    expect(isPrivateOrReservedIPv4("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIPv4("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIPv4("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIPv4("172.31.255.255")).toBe(true);
    expect(isPrivateOrReservedIPv4("169.254.169.254")).toBe(true); // AWS metadata
    expect(isPrivateOrReservedIPv4("0.0.0.0")).toBe(true);
    expect(isPrivateOrReservedIPv4("224.0.0.1")).toBe(true); // Multicast
    expect(isPrivateOrReservedIPv4("255.255.255.255")).toBe(true);
    expect(isPrivateOrReservedIPv4("100.64.0.1")).toBe(true); // Carrier grade NAT
  });

  it("accepts valid public IPv4 addresses", () => {
    expect(isPrivateOrReservedIPv4("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIPv4("1.1.1.1")).toBe(false);
    expect(isPrivateOrReservedIPv4("93.184.216.34")).toBe(false);
    expect(isPublicIP("93.184.216.34")).toBe(true);
  });

  it("rejects loopback, ULA, link-local, multicast, and IPv4-mapped IPv6", () => {
    expect(isPrivateOrReservedIPv6("::1")).toBe(true);
    expect(isPrivateOrReservedIPv6("::")).toBe(true);
    expect(isPrivateOrReservedIPv6("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIPv6("fd12:3456:789a::1")).toBe(true);
    expect(isPrivateOrReservedIPv6("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIPv6("ff02::1")).toBe(true);
    expect(isPrivateOrReservedIPv6("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIPv6("::ffff:192.168.0.1")).toBe(true);
    expect(isPrivateOrReservedIPv6("::ffff:169.254.169.254")).toBe(true);
  });

  it("rejects URLs with embedded credentials", () => {
    expect(() => validateUrl("https://admin:secret@example.com/job")).toThrow(
      SafeFetchError
    );
    expect(() => validateUrl("https://user@example.com/job")).toThrow(
      SafeFetchError
    );
  });

  it("rejects non-HTTP protocols", () => {
    expect(() => validateUrl("ftp://example.com/job")).toThrow(SafeFetchError);
    expect(() => validateUrl("file:///etc/passwd")).toThrow(SafeFetchError);
    expect(() => validateUrl("gopher://example.com")).toThrow(SafeFetchError);
  });

  it("rejects localhost and internal hostnames", () => {
    expect(() => validateUrl("http://localhost:3000")).toThrow(SafeFetchError);
    expect(() => validateUrl("http://myhost.localhost")).toThrow(SafeFetchError);
    expect(() => validateUrl("http://internal.local")).toThrow(SafeFetchError);
  });

  it("extracts employer public registrable domain and discards job boards/free emails", () => {
    expect(extractEmployerRegistrableDomain("https://careers.acme.co.in/job/1")).toBe("acme.co.in");
    expect(extractEmployerRegistrableDomain("jobs.google.com")).toBe("google.com");
    expect(extractEmployerRegistrableDomain("https://www.linkedin.com/jobs/view/123")).toBe(null);
    expect(extractEmployerRegistrableDomain("recruiter@gmail.com")).toBe(null);
    expect(extractEmployerRegistrableDomain("naukri.com")).toBe(null);
  });

  it("sanitizes HTML stripping scripts, styles and nav elements", () => {
    const rawHtml = `
      <html>
        <head>
          <title>Test Page</title>
          <script>alert('xss')</script>
          <style>body { color: red; }</style>
        </head>
        <body>
          <nav><a href="/">Home</a></nav>
          <h1>Software Engineer</h1>
          <p>We are hiring immediately! Salary: 50,000 INR.</p>
          <footer>Copyright 2026</footer>
        </body>
      </html>
    `;
    const text = sanitizeHtmlToText(rawHtml);
    expect(text).not.toContain("alert('xss')");
    expect(text).not.toContain("body { color: red; }");
    expect(text).not.toContain("<p>");
    expect(text).toContain("Software Engineer");
    expect(text).toContain("Salary: 50,000 INR.");
  });

  it("exports a real browser User-Agent string", () => {
    expect(BROWSER_USER_AGENT).toContain("Mozilla/5.0");
    expect(BROWSER_USER_AGENT).toContain("AppleWebKit/537.36");
    expect(BROWSER_USER_AGENT).toContain("Chrome/126.0");
    expect(BROWSER_USER_AGENT).toContain("Safari/537.36");
  });

  it("identifies blocked_page as an error code on SafeFetchError", () => {
    const err = new SafeFetchError("Target page refused access (HTTP 403).", "blocked_page");
    expect(err.code).toBe("blocked_page");
    expect(err.message).toContain("403");
  });
});


