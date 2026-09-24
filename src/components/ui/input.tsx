import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn("min-w-0 border-0 bg-transparent text-white outline-none placeholder:text-slate-400", className)}
      {...props}
    />
  ),
);

Input.displayName = "Input";
