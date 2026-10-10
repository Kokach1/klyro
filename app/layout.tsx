import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Scam Detector",
  description: "Check a job post before you apply or pay. Deterministic, evidence-backed evaluation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
