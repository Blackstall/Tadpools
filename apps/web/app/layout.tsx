import "./globals.css";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import NavBar from "../components/NavBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Tadpools — KYC Intelligence",
  description: "Swarm intelligence for safer onboarding",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} style={{ height: "100%" }}>
      <body style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <NavBar />
        <main style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
