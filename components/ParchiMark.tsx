// The Parchi logo from the design: "parchi." with the dot in the theme's accent colour.
const SIZES = { sm: "text-2xl", md: "text-4xl", lg: "text-6xl" };

export default function ParchiMark({ size = "md" }: { size?: keyof typeof SIZES }) {
  return (
    <span className={`font-extrabold tracking-tighter ${SIZES[size]}`}>
      parchi<span className="text-accent">.</span>
    </span>
  );
}
