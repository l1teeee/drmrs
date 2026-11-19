import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { adminHref } from "@/infrastructure/admin/admin-path";
import { requireAdmin } from "@/infrastructure/auth/require-admin";

import { LoginForm } from "./LoginForm";

const FOCO_PAPEL =
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-tinta";

export default async function LoginPage() {
  await connection();
  const authorization = await requireAdmin("action");
  if (authorization.ok) {
    redirect(adminHref());
  }

  return (
    <main className="relative min-h-dvh grid place-items-center overflow-hidden bg-papel text-tinta">
      <Image src="/textura-papel.jpg" alt="" fill className="object-cover" />

      <div className="relative w-full max-w-[360px] px-6">
        <div className="flex justify-center">
          <Link href="/" aria-label="drmr, volver al sitio" className={FOCO_PAPEL}>
            <Image
              src="/drmr-logo.svg"
              alt="drmr"
              width={177}
              height={72}
              preload
              className="h-[clamp(56px,8vw,96px)] w-auto"
            />
          </Link>
        </div>

        <div className="mt-12">
          <LoginForm />
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className={`font-mono text-[12px] text-tinta/60 hover:text-tinta ${FOCO_PAPEL}`}
          >
            ← volver al sitio
          </Link>
        </div>
      </div>
    </main>
  );
}
