import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { XIcon } from "lucide-react"

const DialogContext = React.createContext<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
}>({})

function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({
  children,
  asChild,
  className,
  ...props
}: {
  children?: React.ReactNode
  asChild?: boolean
  className?: string
  [key: string]: any
}) {
  const context = React.useContext(DialogContext)
  const Comp = asChild ? Slot : "button"
  
  return (
    <Comp
      type={asChild ? undefined : "button"}
      onClick={(e: React.MouseEvent) => {
        if (asChild && React.isValidElement(children)) {
          (children.props as any).onClick?.(e)
        }
        context.onOpenChange?.(true)
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </Comp>
  )
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function DialogOverlay({ className }: { className?: string }) {
  const context = React.useContext(DialogContext)
  if (!context.open) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
        className
      )}
      onClick={() => context.onOpenChange?.(false)}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  showCloseButton?: boolean
}) {
  const context = React.useContext(DialogContext)
  if (!context.open) return null

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        className={cn(
          // max-h + overflow: janelas mais altas que a tela ganham barra de rolagem em vez de cortar o conteudo.
          "fixed left-[50%] top-[50%] z-50 grid max-h-[90vh] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            onClick={() => context.onOpenChange?.(false)}
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

const DialogClose = ({ children }: { children: React.ReactNode }) => {
  const context = React.useContext(DialogContext)
  return (
    <div onClick={() => context.onOpenChange?.(false)}>
      {children}
    </div>
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
