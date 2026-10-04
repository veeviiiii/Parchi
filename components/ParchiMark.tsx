// The Parchi wordmark: पर्ची in Rozha One, with a small Latin "Parchi" under it.
const SIZES = { sm: "text-3xl", md: "text-5xl", lg: "text-7xl sm:text-8xl" };

export default function ParchiMark({ size = "md" }: { size?: keyof typeof SIZES }) {
  return (
    <span className="inline-flex flex-col items-start">
      <span lang="hi" className={`font-rozha leading-none ${SIZES[size]}`}>
        पर्ची
      </span>
      <span className="text-xs font-medium tracking-wide">Parchi</span>
    </span>
  );
}
