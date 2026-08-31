// Same mark as metgiga.com's nav — exact path data copied from
// metgiga-website/index.html for brand continuity, without the animated
// glow filter (this app doesn't load that filter def, and a static mark
// suits an authenticated app better than the marketing site's entrance
// animation).
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <circle cx="40" cy="50" r="4" fill="#B4693D" />
      <circle cx="160" cy="50" r="4" fill="#B4693D" />
      <path
        d="M40,50 L40,150 L92,100 Z"
        stroke="#B4693D"
        strokeWidth="2.5"
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
      <path
        d="M160,50 L160,150 L108,100 Z"
        stroke="#B4693D"
        strokeWidth="2.5"
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
      <path
        d="M100,88 L112,100 L100,112 L88,100 Z"
        stroke="#B4693D"
        strokeWidth="2.5"
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
    </svg>
  );
}
