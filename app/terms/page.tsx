import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-[#F4F5F8] px-6 py-16">
      <article className="rounded-[28px] bg-white p-8 shadow-card">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Terms of use</h1>
        <p className="mt-4 text-sm leading-6 text-secondary">
          This page is a draft for the owner to replace after a legal review. Aayaam does not file GST returns, settle bank payments, or send messages unless a connected provider confirms that action. Plan prices on the Plans page are not a checkout.
        </p>
        <Link href="/" className="mt-6 inline-flex text-sm font-medium text-accent">
          Back to Aayaam
        </Link>
      </article>
    </main>
  );
}
