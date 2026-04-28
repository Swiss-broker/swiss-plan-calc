import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_30%,transparent),inset_0_-1px_0_0_color-mix(in_oklab,black_15%,transparent),0_1px_2px_oklch(0_0_0/0.08),0_4px_12px_-2px_color-mix(in_oklab,var(--primary)_35%,transparent)] hover:shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_35%,transparent),inset_0_-1px_0_0_color-mix(in_oklab,black_15%,transparent),0_2px_4px_oklch(0_0_0/0.10),0_8px_20px_-4px_color-mix(in_oklab,var(--primary)_45%,transparent)] hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_25%,transparent),0_2px_8px_-2px_color-mix(in_oklab,var(--destructive)_40%,transparent)] hover:bg-destructive/90 hover:-translate-y-0.5",
        outline:
          "border border-input bg-background/60 backdrop-blur-md shadow-sm hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_50%,transparent),0_1px_3px_oklch(0_0_0/0.06)] hover:bg-secondary/80 hover:-translate-y-0.5",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
