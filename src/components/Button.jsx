const variants = {
  primary:
    'bg-dark-green text-white hover:bg-[#143022] active:bg-[#0f2419] disabled:opacity-50',
  secondary:
    'bg-light-grey text-dark-green hover:bg-[#ebebeb] active:bg-[#e0e0e0] disabled:opacity-50',
  outline:
    'border-2 border-dark-green bg-transparent text-dark-green hover:bg-dark-green/5 active:bg-dark-green/10 disabled:opacity-50',
  gold: 'bg-gold text-dark-green hover:bg-[#b8993f] active:bg-[#a88a35] disabled:opacity-50',
  danger:
    'bg-transparent text-danger hover:bg-red-50 active:bg-red-100 disabled:opacity-50',
  ghost:
    'bg-transparent text-dark-green hover:bg-light-grey active:bg-[#ebebeb] disabled:opacity-50',
}

const sizes = {
  sm: 'min-h-[44px] px-4 py-2 text-sm',
  md: 'min-h-[52px] px-6 py-3 text-base',
  lg: 'min-h-[56px] px-8 py-4 text-lg',
  icon: 'min-h-[48px] min-w-[48px] p-3',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  fullWidth = false,
  ...props
}) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
