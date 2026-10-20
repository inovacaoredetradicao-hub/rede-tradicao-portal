import * as React from "react"
import { cn } from "@/lib/utils"

// Select com a mesma API do shadcn (Select > SelectTrigger > SelectValue / SelectContent >
// SelectItem), renderizado como <select> nativo. A versao anterior era so um esqueleto:
// mostrava o texto mas ignorava as opcoes, entao o filtro nao abria.
type SelectOption = { value: string; label: React.ReactNode; disabled?: boolean }

function collectSelectParts(children: React.ReactNode) {
  const options: SelectOption[] = []
  let placeholder: React.ReactNode = undefined
  let triggerClassName: string | undefined
  const visit = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child: any) => {
      if (!React.isValidElement(child)) return
      const element = child as React.ReactElement<any>
      if (element.type === SelectItem) {
        options.push({ value: String(element.props.value), label: element.props.children, disabled: element.props.disabled })
        return
      }
      if (element.type === SelectValue) {
        placeholder = element.props.placeholder
        return
      }
      if (element.type === SelectTrigger) triggerClassName = element.props.className
      if (element.props?.children) visit(element.props.children)
    })
  }
  visit(children)
  return { options, placeholder, triggerClassName }
}

const textOf = (label: React.ReactNode): string =>
  typeof label === "string" || typeof label === "number"
    ? String(label)
    : Array.isArray(label)
      ? label.map(textOf).join("")
      : React.isValidElement(label)
        ? textOf((label.props as any).children)
        : ""

const Select = ({ children, value, onValueChange, disabled, className }: any) => {
  const { options, placeholder, triggerClassName } = collectSelectParts(children)
  const hasValue = options.some((option) => option.value === value)
  return (
    <select
      value={hasValue ? value : ""}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.value)}
      className={cn(
        "flex h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        triggerClassName,
        className
      )}
    >
      {!hasValue && <option value="">{textOf(placeholder) || "Selecione"}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {textOf(option.label)}
        </option>
      ))}
    </select>
  )
}

// Marcadores: so carregam informacao para o Select acima (nao renderizam sozinhos).
const SelectTrigger = ({ children }: any) => <>{children}</>
const SelectValue = (_props: any) => null
const SelectContent = ({ children }: any) => <>{children}</>
const SelectItem = (_props: any) => null
const SelectGroup = ({ children }: any) => <>{children}</>
const SelectLabel = (_props: any) => null
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
