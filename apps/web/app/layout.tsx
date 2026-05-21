import type { Metadata } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "OGFI Inventory",
  description:
    "Centralized inventory, costing, reporting, and offline sync console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-inter">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
