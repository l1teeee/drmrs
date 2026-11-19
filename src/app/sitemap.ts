import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://drmr.com.mx";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/registro`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/reglas`, changeFrequency: "weekly", priority: 0.3 },
    { url: `${siteUrl}/aviso-de-privacidad`, changeFrequency: "weekly", priority: 0.3 },
  ];
}
