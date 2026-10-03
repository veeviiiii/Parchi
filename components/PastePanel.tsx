type Props = {
  text: string;
  onTextChange: (text: string) => void;
  onLoadSample: () => void;
  onBuild: () => void;
  building: boolean;
  status: string | null; // progress or a hint, shown under the buttons
};

export default function PastePanel({ text, onTextChange, onLoadSample, onBuild, building, status }: Props) {
  return (
    <section className="rounded-lg bg-paper p-4 shadow-sm">
      <label htmlFor="chat" className="mb-2 block font-medium">
        Group chat
      </label>
      <textarea
        id="chat"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={8}
        placeholder="[03/10, 9:02 pm] Rahul: bhai 2 copy chahiye"
        className="w-full rounded border border-rule p-2 font-mono text-sm"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onLoadSample}
          disabled={building}
          className="rounded border border-ink px-4 py-2 disabled:opacity-50"
        >
          Load sample chat
        </button>
        <button
          type="button"
          onClick={onBuild}
          disabled={building}
          className="rounded bg-ink px-4 py-2 font-medium text-paper disabled:opacity-50"
        >
          {building ? "Building…" : "Build order"}
        </button>
      </div>
      {status && (
        <p className="mt-3 text-sm" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
