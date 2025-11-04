import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CopilotKit } from "@copilotkit/react-core";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinanceAI Agent - Smart Portfolio Tracker",
  description: "AI-powered financial assistant for portfolio management and stock analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use backend URL from environment variable, fallback to local API route for development
  const runtimeUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "/api/copilotkit";

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <CopilotKit runtimeUrl={runtimeUrl} agent="financeAgent">
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
