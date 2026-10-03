import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./styles";

type Props = {
  text: string;
  onTextChange: (text: string) => void;
  onLoadSample: () => void;
  onBuild: () => void;
  building: boolean;
  status: string | null; // progress or a hint, shown under the buttons
};

export default function PastePanel({ text, onTextChange, onLoadSample, onBuild, building, status }: Props) {
  // Reads a WhatsApp "Export chat" .txt file into the text box.
  async function upload(file: File | undefined) {
    if (file) onTextChange(await file.text());
  }

  return (
    <section className="rounded-lg bg-paper p-4 shadow-sm">
      <label htmlFor="chat" className="mb-2 block font-semibold">
        Group chat
      </label>
      <textarea
        id="chat"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={8}
        placeholder="[03/10, 9:02 pm] Rahul: bhai 2 copy chahiye"
        className="w-full rounded border border-rule p-3 text-base leading-snug placeholder:text-ink/60"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onLoadSample} disabled={building} className={SECONDARY_BUTTON}>
          Load sample chat
        </button>
        <label
          className={`${SECONDARY_BUTTON} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2`}
        >
          Upload chat export
          <input
            type="file"
            accept=".txt,text/plain"
            disabled={building}
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = ""; // so the same file can be picked again
            }}
            className="sr-only"
          />
        </label>
        <button type="button" onClick={onBuild} disabled={building} className={PRIMARY_BUTTON}>
          {building ? "Building…" : "Build order"}
        </button>
      </div>
      {status && (
        <p className="mt-3" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
