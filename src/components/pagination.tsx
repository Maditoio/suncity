"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

export function usePager<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize) || 1);

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), pages));
  }, [pages]);

  return {
    page,
    pages,
    total: items.length,
    slice: items.slice((page - 1) * pageSize, page * pageSize),
    setPage,
  };
}

export function Pager({
  page,
  pages,
  total,
  onPage,
  noun = "items",
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
      <p className="text-text-2">
        {total} {noun} · page {page} of {pages}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
