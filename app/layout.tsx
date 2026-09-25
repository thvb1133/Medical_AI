import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Neura — AI-assisted mental health monitoring",
  description:
    "A conversational companion that measures voice and video biomarkers in real time, so clinicians can see how someone is doing between appointments.",
};

export const viewport: Viewport = {
  themeColor: "#101f1f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
