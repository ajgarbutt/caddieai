export default function Card({
  children,
  className = '',
  padding = 'md',
  onClick,
}) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }

  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'w-full rounded-2xl bg-light-grey text-left',
        paddingClasses[padding],
        onClick
          ? 'cursor-pointer transition-colors hover:bg-[#ebebeb] active:bg-[#e0e0e0]'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Component>
  )
}
