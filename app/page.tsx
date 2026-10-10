export default function Home() {
  return (
    <main style={{ maxWidth: "var(--max-width)", margin: "0 auto", padding: "24px 16px" }}>
      <header style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1>Job Scam Detector</h1>
          <a href="#methodology" style={{ fontSize: "14px" }}>Methodology</a>
        </div>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
          Check a job post before you apply or pay.
        </p>
      </header>
    </main>
  );
}
