type BrandMarkProps = { className?: string };

/**
 * The mark of the header: a small logo of a card with a diamond of filled dots among open rings. It is a logo, not a picture of a card.
 * Decoration beside the visible name, so it is hidden from assistive technology. It takes its colour from the text colour.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false" data-brand-mark="">
      <path d="M8 3h12l6 6v18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="11" r="2" fill="currentColor" />
      <circle cx="11" cy="17" r="2" fill="currentColor" />
      <circle cx="21" cy="17" r="2" fill="currentColor" />
      <circle cx="16" cy="23" r="2" fill="currentColor" />
      <circle cx="11" cy="11" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="16" cy="17" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="11" cy="23" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="21" cy="23" r="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
