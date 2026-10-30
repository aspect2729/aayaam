export function record(businessId: string, action: string, detail: string) {
  void fetch("/api/activity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessId, action, detail }),
  });
}
