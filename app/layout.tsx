import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { AppChromeMeasure } from "@/components/AppChromeMeasure";
import { withBasePath } from "@/lib/basePath";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YTX | YouTube lifecycle",
  description: "Show lifecycle ops for ScalpX YouTube channels.",
  applicationName: "YTX",
  icons: {
    icon: [{ url: withBasePath("/ytx-logo.svg"), type: "image/svg+xml" }],
    apple: [{ url: withBasePath("/ytx-logo.png"), type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#070907",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="ytx-app">
          <AppSidebar />
          <AppChromeMeasure />
          <div className="ytx-main track-workspace">{children}</div>
          <MobileTabBar />
        </div>
      </body>
    </html>
  );
}
