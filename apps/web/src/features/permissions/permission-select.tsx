import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function PermissionSelect({
  id,
  label,
  value,
  onChange,
  items,
  disabled,
}: {
  id?: string
  label: string
  value: string
  onChange: (value: string) => void
  items: Array<{ value: string; label: string }>
  disabled?: boolean
}) {
  return (
    <Select
      items={items}
      value={value || null}
      onValueChange={(next) => {
        if (next !== null) onChange(next)
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={label} className="w-full">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
