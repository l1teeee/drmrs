"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Subrayado } from "@/components/Maquina";

interface NavArchivoItem {
  href: string;
  label: string;
}

interface NavArchivoProps {
  items: NavArchivoItem[];
}

function matchLength(pathname: string, href: string) {
  if (pathname === href || pathname.startsWith(`${href}/`)) {
    return href.length;
  }
  return -1;
}

function activeHref(pathname: string, items: NavArchivoItem[]) {
  let best: string | null = null;
  let bestLength = -1;
  for (const item of items) {
    const length = matchLength(pathname, item.href);
    if (length > bestLength) {
      best = item.href;
      bestLength = length;
    }
  }
  return best;
}

export function NavArchivo({ items }: NavArchivoProps) {
  const pathname = usePathname();
  const active = activeHref(pathname, items);

  return (
    <nav aria-label="Archivo" className="flex flex-wrap gap-x-8 gap-y-2 text-[15px]">
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`transition-colors duration-300 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-azul motion-reduce:transition-none ${
              isActive ? "text-azul" : "text-tinta/75 hover:text-azul"
            }`}
          >
            {isActive ? <Subrayado>{item.label}</Subrayado> : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
