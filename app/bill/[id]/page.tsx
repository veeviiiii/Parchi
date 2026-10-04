"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import ParchiMark from "@/components/ParchiMark";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/styles";
import { amountInWords, BILL_FOOTER, billText, formatAmount, formatBillDate } from "@/lib/bill";
import { useBill } from "@/lib/billStore";
import { copyText } from "@/lib/browser";
import { formatRupees } from "@/lib/money";
import { useProfile } from "@/lib/profile";

// A printable bill, read from this browser's saved bills.
export default function BillPage() {
  const { id } = useParams<{ id: string }>();
  const { bill, ready } = useBill(decodeURIComponent(id));
  const { profile } = useProfile();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState<string | null>(null);

  async function copy(text: string) {
    if (await copyText(text)) {
      setManualCopy(null);
      setFeedback("Copied.");
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setManualCopy(text);
      setFeedback("Couldn't copy automatically. Select the text below and copy it.");
    }
  }

  return (
    <>
      {profile && <AppHeader profile={profile} />}
      <main className="mx-auto w-full max-w-3xl px-4 py-6 print:max-w-none print:p-0">
        {!ready && <p>Loading…</p>}

        {ready && !bill && (
          <>
            <p className="text-lg">This bill isn&apos;t saved on this device.</p>
            <Link href="/order" className="mt-2 inline-block underline">
              Back to the order
            </Link>
          </>
        )}

        {bill && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
              <button type="button" onClick={() => window.print()} className={PRIMARY_BUTTON}>
                Print / Save as PDF
              </button>
              <button type="button" onClick={() => copy(billText(bill))} className={SECONDARY_BUTTON}>
                Copy bill as text
              </button>
              <Link href="/order" className="min-h-11 content-center px-2 underline">
                Back to the order
              </Link>
              <p className="w-full min-h-6" role="status">
                {feedback}
              </p>
              {manualCopy && (
                <textarea
                  readOnly
                  value={manualCopy}
                  rows={manualCopy.split("\n").length}
                  onFocus={(e) => e.target.select()}
                  aria-label="Bill text to copy"
                  className="w-full rounded border border-rule p-2 text-base"
                />
              )}
            </div>

            <article className="rounded-lg bg-paper p-5 shadow-sm sm:p-10 print:rounded-none print:p-0 print:shadow-none">
              <header className="flex flex-wrap items-start justify-between gap-4">
                <ParchiMark size="md" />
                <div className="text-right">
                  <p className="text-sm">Bill no.</p>
                  <p className="font-semibold">{bill.id}</p>
                  <p className="text-sm">{formatBillDate(bill.createdAt)}</p>
                </div>
              </header>

              <dl className="mt-8 grid gap-4 sm:grid-cols-2">
                {bill.from && (
                  <div>
                    <dt className="text-sm">From</dt>
                    <dd className="font-semibold break-words">{bill.from}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm">To</dt>
                  <dd className="font-semibold break-words">{bill.to}</dd>
                </div>
              </dl>

              <table className="mt-8 w-full border-collapse text-sm sm:text-base">
                <thead>
                  <tr className="border-b-2 border-ink text-left">
                    <th className="py-2 pr-2 font-semibold">#</th>
                    <th className="py-2 pr-2 font-semibold">Item</th>
                    <th className="py-2 pr-2 text-right font-semibold">Qty</th>
                    <th className="py-2 pr-2 text-right font-semibold">Rate (₹)</th>
                    <th className="py-2 text-right font-semibold">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.lines.map((line, i) => (
                    <tr key={i} className="border-b border-rule align-top">
                      <td className="py-2 pr-2">{i + 1}</td>
                      <td className="py-2 pr-2 break-words">{line.item}</td>
                      <td className="py-2 pr-2 text-right">{line.quantity}</td>
                      <td className="py-2 pr-2 text-right">{formatAmount(line.ratePaise)}</td>
                      <td className="py-2 text-right">{formatAmount(line.amountPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 ml-auto max-w-xs">
                <div className="flex justify-between py-1">
                  <span>Subtotal</span>
                  <span>{formatRupees(bill.totalPaise / 100)}</span>
                </div>
                <div className="flex justify-between border-t-2 border-ink py-2 text-lg font-semibold">
                  <span>Grand total</span>
                  <span>{formatRupees(bill.totalPaise / 100)}</span>
                </div>
              </div>
              <p className="mt-2 text-right italic">{amountInWords(bill.totalPaise / 100)}</p>

              {bill.split && (
                <section className="mt-8">
                  <h2 className="font-semibold">Split</h2>
                  <ul className="mt-1 max-w-sm">
                    {bill.split.map((share) => (
                      <li key={share.name} className="flex justify-between gap-3 border-b border-rule py-1.5">
                        <span className="break-words">{share.name}</span>
                        <span>{formatRupees(share.amountPaise / 100)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <footer className="mt-10 border-t border-rule pt-3 text-center text-sm">
                {BILL_FOOTER.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </footer>
            </article>
          </>
        )}
      </main>
    </>
  );
}
