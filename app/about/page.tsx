import Link from "next/link";
import { MethodologySection } from "@/components/MethodologySection";

export default function AboutPage() {
  return (
    <main style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "28px 16px" }}>
      <header
        style={{
          borderBottom: "3px solid #000000",
          paddingBottom: "18px",
          marginBottom: "28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "16px",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.5px" }}>
          Job Scam Detector
        </h1>
        <Link href="/" style={{ fontSize: "13px", fontWeight: 700 }}>
          Start a check
        </Link>
      </header>

      <MethodologySection />
    </main>
  );
}
