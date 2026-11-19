import darkLogo from "@/assets/ethio-telecom-dark.svg"
import lightLogo from "@/assets/ethio-telecom-light.svg"
import { cn } from "@/lib/utils"

export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <img
        src={lightLogo}
        alt="Ethio telecom"
        className={cn("block dark:hidden", className)}
      />
      <img
        src={darkLogo}
        alt="Ethio telecom"
        className={cn("hidden dark:block", className)}
      />
    </>
  )
}
