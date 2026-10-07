import * as React from "react"
import { cn } from "@/lib/utils"

const Select = ({ children, value, onValueChange, ...props }: any) => {
  return (
    <div className="relative">
      {React.Children.map(children, child => {
        if (child.type === SelectTrigger) {
          return React.cloneElement(child, { value, onValueChange })
        }
        return null
      })}
    </div>
  )
}

const SelectTrigger = ({ className, children, value, onValueChange, ...props }: any) => {
  return (
    <div className={cn("relative", className)}>
      {children}
    </div>
  )
}

const SelectValue = ({ placeholder, value }: any) => {
  return <span>{value || placeholder}</span>
}

const SelectContent = ({ children }: any) => null
const SelectItem = ({ children }: any) => null
const SelectGroup = ({ children }: any) => children
const SelectLabel = ({ children }: any) => null
const SelectSeparator = () => null
const SelectScrollUpButton = () => null
const SelectScrollDownButton = () => null

// Simplified version for the app's needs
export const CustomSelect = ({ options, value, onValueChange, placeholder, className }: any) => {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
