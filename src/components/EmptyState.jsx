export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-light-grey">
          <Icon className="h-8 w-8 text-dark-green/60" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="mb-2 text-lg font-semibold text-dark-green">{title}</h3>
      {description && (
        <p className="mb-6 max-w-xs text-sm leading-relaxed text-gray-600">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
