const day = 24 * 60 * 60 * 1000;

export function profileChangeAllowed(lastChangeAt: string | null, now = new Date()) {
  if (!lastChangeAt) return { allowed: true, reason: "No profile edit has been approved this week." };
  const elapsed = now.getTime() - new Date(lastChangeAt).getTime();
  if (elapsed < 7 * day) return { allowed: false, reason: "Only one profile-field batch is allowed in seven days." };
  return { allowed: true, reason: "The weekly profile cool-down has passed." };
}

export function postSlotAllowed(lastPostAt: string | null, cadenceDays: number, now = new Date()) {
  const cadence = Math.min(7, Math.max(2, cadenceDays));
  if (!lastPostAt) return { allowed: true, cadenceDays: cadence, reason: "No post is on record, so a draft can be proposed." };
  const elapsed = now.getTime() - new Date(lastPostAt).getTime();
  if (elapsed < cadence * day) return { allowed: false, cadenceDays: cadence, reason: `The next post waits for the ${cadence}-day cadence.` };
  return { allowed: true, cadenceDays: cadence, reason: "The cadence allows a new draft." };
}
