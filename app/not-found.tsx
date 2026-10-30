import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-card border border-line bg-white p-8 text-center shadow-card">
        <p className="text-sm text-secondary">404</p>
        <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.02em]">This page is not in the workspace</h1>
        <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-inner bg-accent px-4 text-sm font-medium text-white">
          Back to Business Brain
        </Link>
      </div>
    </div>
  );
}
