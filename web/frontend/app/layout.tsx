import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "X Content Scraper",
  description:
    "Scrape tweets and articles from X, transform into SOPs, PIDs, and concept docs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: "#0a0a0a",
          color: "#ededed",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
