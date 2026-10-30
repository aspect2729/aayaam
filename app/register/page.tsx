"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", businessName: "", city: "", businessType: "retail", gstin: "" });
  const [ecommerce, setEcommerce] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setError("");
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, ecommerceBilling: ecommerce }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error?.message ?? "Could not create the workspace");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#F4F5F8] px-4 py-10">
      <form
        className="w-full max-w-lg rounded-[28px] bg-white p-8 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Create your business</h1>
        <p className="mt-2 text-sm text-secondary">INR and Asia/Kolkata are the defaults. Historical records keep their own currency.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Field label="Your name" value={form.name} onChange={set("name")} />
          <Field label="Email" value={form.email} onChange={set("email")} />
          <Field label="Password" value={form.password} onChange={set("password")} type="password" />
          <Field label="Business name" value={form.businessName} onChange={set("businessName")} />
          <Field label="City" value={form.city} onChange={set("city")} />
          <label className="block text-[13px]">
            Type
            <select className="mt-1 h-10 w-full rounded-inner border border-line bg-white px-3 text-sm" value={form.businessType} onChange={(event) => set("businessType")(event.target.value)}>
              <option value="retail">Retail</option>
              <option value="ecommerce">E-commerce brand</option>
              <option value="service">Service</option>
              <option value="gym">Gym</option>
              <option value="handicraft">Handicraft</option>
              <option value="interior">Interior</option>
            </select>
          </label>
          <Field label="GSTIN, if you have one" value={form.gstin} onChange={set("gstin")} />
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={ecommerce} onChange={(event) => setEcommerce(event.target.checked)} />
          <span>This is an e-commerce business. Order-linked invoices stay hidden for every other type.</span>
        </label>
        {error ? <p className="mt-3 text-sm text-[#F04438]">{error}</p> : null}
        <Button className="mt-6 rounded-full" type="submit">Create workspace</Button>
        <p className="mt-4 text-[13px] text-secondary">
          Already registered? <Link className="font-medium text-accent" href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-[13px]">
      {label}
      <Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
