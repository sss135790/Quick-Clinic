import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Watermark from "@/components/general/Watermark";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuickClinic - Modern Healthcare Platform",
  description: "Connect with doctors, manage appointments, and access healthcare services seamlessly",
  authors: [{ name: "Shwet Singh" }, { name: "Priyanshu Goyal" }],
  creator: "Shwet Singh & Priyanshu Goyal",
  publisher: "Quick Clinic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
        <Toaster />
        <Watermark />
        <div style={{ display: 'none' }} aria-hidden="true" data-author="Shwet Singh & Priyanshu Goyal">
          QuickClinic - Made by Shwet Singh & Priyanshu Goyal. All rights reserved.
        </div>
      </body>
    </html>
  );
}
