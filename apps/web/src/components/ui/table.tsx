import * as React from "react";
import { cn } from "@/lib/utils";

const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-auto rounded-md">
    <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
);
const TableHeader = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...p} className={cn("bg-neutral-900 dark:bg-neutral-800", p.className)} />;
const TableBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} className={cn("[&_tr:last-child]:border-0", p.className)} />;
const TableRow = (p: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...p} className={cn("border-b border-border transition-colors hover:bg-muted/60", p.className)} />
);
const TableHead = (p: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th {...p} className={cn("h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-white", p.className)} />
);
const TableCell = (p: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...p} className={cn("px-3 py-2.5 align-middle", p.className)} />
);

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
