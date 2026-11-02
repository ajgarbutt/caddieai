import { Loader2 } from 'lucide-react'

export default function LoadingIndicator({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2
        className="h-8 w-8 animate-spin text-dark-green"
        strokeWidth={2}
      />
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
  )
}
