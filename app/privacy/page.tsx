import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-[#F4F5F8] px-6 py-16">
      <article className="rounded-[28px] bg-white p-8 shadow-card">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Privacy policy</h1>
        <p className="mt-4 text-sm leading-6 text-secondary">
          This page is a draft for the owner to replace after a legal review. Aayaam stores business records for the workspace that created them. Demo workspaces are sample data and are kept apart from a signed-in business. WhatsApp and email are not sent unless a provider is connected and the message is allowed by consent and an approval rule.
        </p>
        <Link href="/" className="mt-6 inline-flex text-sm font-medium text-accent">
          Back to Aayaam
        </Link>
      </article>
    </main>
  );
}
