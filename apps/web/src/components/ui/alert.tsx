import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-red-800 dark:bg-primary/10 dark:text-red-200 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", className)}
      {...props}
    />
  );
}
