import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/shared/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OCDN — Content That Can't Be Killed",
  description:
    "The economic indexing layer for content consumption. Durable sovereign content via economic incentives.",
  openGraph: {
    title: "OCDN — Content That Can't Be Killed",
    description: "Priced by the people who care.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        <Header />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
