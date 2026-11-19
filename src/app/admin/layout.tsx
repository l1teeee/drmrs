import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "drmr",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-tinta">
      <div className="relative min-h-dvh">
        <Suspense fallback={null}>{children}</Suspense>
      </div>
    </div>
  );
}
