import * as React from "react";

import { cn } from "@/lib/utils";
import { useParallaxTilt } from "@/hooks/useParallaxTilt";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Active un léger effet parallax 3D au survol (desktop uniquement). */
  tilt?: boolean;
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, tilt = false, ...props }, ref) => {
    const tiltRef = useParallaxTilt<HTMLDivElement>({ max: 4, scale: 1.005 });
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        if (tilt) (tiltRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref, tilt, tiltRef],
    );
    return (
      <div
        ref={setRefs}
        className={cn(
          "rounded-2xl border bg-card text-card-foreground bg-gradient-surface shadow-3d transition-all duration-300",
          tilt ? "tilt-3d" : "hover-lift",
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
