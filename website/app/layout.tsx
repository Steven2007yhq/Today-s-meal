import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "好吃的今天 - 一日三餐，不再为难";
const description = "面向个人与家庭的智能饮食规划 Windows 桌面应用。用三餐计划、中华菜品库、饭量记录和小饭 AI，让每天吃什么变得更轻松。";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host") ?? "localhost:3000";
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const siteUrl = new URL(`${protocol}://${host}`);
  const shareImage = new URL("/og.png", siteUrl).toString();

  return {
    metadataBase: siteUrl,
    title,
    description,
    icons: { icon: "/icon.png", shortcut: "/icon.png" },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      images: [{ url: shareImage, width: 1200, height: 630, alt: "好吃的今天官网" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [shareImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
