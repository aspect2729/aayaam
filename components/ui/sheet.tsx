"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-[#0B0B10]/30", className)} {...props} />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { side?: "right" | "left" | "bottom" }
>(({ className, children, side = "right", ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden bg-white shadow-card outline-none",
        side === "right" && "inset-y-0 right-0 h-full w-[min(100%,440px)] border-l border-line",
        side === "left" && "inset-y-0 left-0 h-full w-[min(100%,320px)] border-r border-line",
        side === "bottom" && "inset-x-0 bottom-0 max-h-[85vh] rounded-t-card border-t border-line",
        className
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close
        className="absolute right-4 top-4 rounded-full p-1 text-secondary hover:bg-accent-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Close panel"
      >
        <X className="h-4 w-4" />
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-line px-5 py-4 pr-12", className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("text-lg font-semibold tracking-[-0.02em]", className)} {...props} />;
}

function SheetDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("mt-1 text-sm text-secondary", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription };
