import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium tracking-[-0.01em] ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-white/[0.08] text-foreground shadow-[0_14px_34px_rgba(0,0,0,0.26)] hover:-translate-y-0.5 hover:bg-white/[0.11]",
        destructive:
          "bg-destructive/90 text-destructive-foreground shadow-[0_14px_34px_rgba(127,29,29,0.25)] hover:bg-destructive",
        outline:
          "border border-white/[0.08] bg-white/[0.02] text-foreground hover:-translate-y-0.5 hover:bg-white/[0.05]",
        secondary:
          "bg-secondary/90 text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] hover:bg-secondary",
        ghost:
          "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        glass:
          "glass text-foreground hover:-translate-y-0.5 hover:bg-white/[0.05]",
        success:
          "bg-success/90 text-success-foreground shadow-[0_16px_34px_rgba(5,150,105,0.22)] hover:bg-success",
        wallet:
          "bg-[linear-gradient(135deg,#A855F7_0%,#8B5CF6_42%,#22D3EE_100%)] text-primary-foreground shadow-[0_18px_36px_rgba(34,211,238,0.16)] hover:-translate-y-0.5 hover:saturate-[1.06] font-semibold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3",
        lg: "h-12 rounded-2xl px-8 text-base",
        xl: "h-14 rounded-[20px] px-10 text-lg",
        icon: "h-10 w-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
