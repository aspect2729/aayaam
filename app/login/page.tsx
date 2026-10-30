"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("rohan@aayaam.local");
  const [password, setPassword] = useState("aayaam-local-demo");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error?.message ?? "Sign-in failed");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#F4F5F8] px-4">
      <form
        className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">A</span>
        <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">Sign in to Aayaam</h1>
        <p className="mt-2 text-sm text-secondary">Your business. One intelligent system.</p>
        <label className="mt-6 block text-[13px]">
          Email
          <Input className="mt-1" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
        </label>
        <label className="mt-3 block text-[13px]">
          Password
          <Input className="mt-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        {error ? <p className="mt-3 text-sm text-[#F04438]">{error}</p> : null}
        <Button className="mt-6 w-full rounded-full" type="submit">
          Continue
        </Button>
        <p className="mt-4 text-[13px] text-secondary">
          New business? <Link className="font-medium text-accent" href="/register">Create a workspace</Link>
        </p>
        <p className="mt-3 text-[12px] text-muted">The local demo signs in as Rohan. Change AAYAAM_DEMO_PASSWORD before any shared deployment.</p>
      </form>
    </main>
  );
}
