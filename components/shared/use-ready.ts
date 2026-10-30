"use client";

import { useEffect, useState } from "react";
import { useBusiness } from "@/lib/business-context";

export function useReady() {
  const { businessId } = useBusiness();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), 380);
    return () => window.clearTimeout(timer);
  }, [businessId]);

  return ready;
}
