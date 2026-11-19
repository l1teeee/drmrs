import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://drmr.com.mx";

export default function robots(): MetadataRoute.Robots {
  if (new URL(siteUrl).hostname !== "drmr.com.mx") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/expediente/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
