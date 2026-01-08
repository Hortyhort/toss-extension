import { useEffect } from "react"
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from "@heroicons/react/24/solid"

export type ToastType = "success" | "error" | "info"

interface ToastProps {
  message: string
  type?: ToastType
  onClose: () => void
  duration?: number
}

export const Toast = ({ message, type = "info", onClose, duration = 3000 }: ToastProps) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const bgColors = {
    success: "bg-green-100 border-green-200 text-green-800",
    error: "bg-red-100 border-red-200 text-red-800",
    info: "bg-blue-100 border-blue-200 text-blue-800"
  }

  const Icons = {
    success: CheckCircleIcon,
    error: ExclamationCircleIcon,
    info: InformationCircleIcon
  }

  const Icon = Icons[type]

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-bottom-2 ${bgColors[type]}`}>
      <Icon className="w-5 h-5" />
      <span>{message}</span>
    </div>
  )
}
