type Props = {
  variant: 'nav' | 'card' | 'footer'
}

const copy = {
  nav: 'Okache',
  card: 'Try Okache',
  footer: 'Built by the makers of Okache',
} as const

export function OkacheCTA({ variant }: Props) {
  const className =
    variant === 'nav'
      ? 'rounded-md bg-accent px-3 py-2 text-canvas'
      : variant === 'card'
        ? 'rounded-md bg-midnight px-4 py-2 text-canvas'
        : 'text-sm text-midnight underline'

  return (
    <a href="https://okache.com" target="_blank" rel="noreferrer" className={className}>
      {copy[variant]}
    </a>
  )
}
