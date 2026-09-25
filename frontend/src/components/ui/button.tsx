import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "icon";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 font-medium transition",
        variant === "primary" && "bg-blue-500/35 text-white hover:bg-blue-500/50",
        variant === "ghost" && "bg-transparent text-blue-200 hover:bg-white/8",
        variant === "icon" && "h-10 w-10 rounded-full bg-transparent text-white hover:bg-white/8",
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
