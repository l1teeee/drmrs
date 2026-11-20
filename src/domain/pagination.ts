export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

export function pageBounds(total: number, page: number, size: number): { page: number; totalPages: number; offset: number } {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), totalPages);
  return { page: current, totalPages, offset: (current - 1) * size };
}

export function paginate<T>(items: T[], page: number, size: number): Page<T> {
  const bounds = pageBounds(items.length, page, size);
  return {
    items: items.slice(bounds.offset, bounds.offset + size),
    page: bounds.page,
    totalPages: bounds.totalPages,
    total: items.length,
  };
}
