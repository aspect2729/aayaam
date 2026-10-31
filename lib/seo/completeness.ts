export type ProfileChecklist = {
  primaryCategory?: string;
  description?: string;
  serviceCount?: number;
  hours?: boolean;
  phone?: string;
  website?: string;
  photoCount?: number;
};

const items: Array<{ key: keyof ProfileChecklist; label: string; done: (profile: ProfileChecklist) => boolean }> = [
  { key: "primaryCategory", label: "Primary category", done: (profile) => Boolean(profile.primaryCategory?.trim()) },
  { key: "description", label: "Description", done: (profile) => Boolean(profile.description && profile.description.length >= 40 && profile.description.length <= 750) },
  { key: "serviceCount", label: "Services", done: (profile) => (profile.serviceCount ?? 0) > 0 },
  { key: "hours", label: "Opening hours", done: (profile) => profile.hours === true },
  { key: "phone", label: "Phone", done: (profile) => Boolean(profile.phone?.trim()) },
  { key: "website", label: "Website", done: (profile) => Boolean(profile.website?.trim()) },
  { key: "photoCount", label: "Photos", done: (profile) => (profile.photoCount ?? 0) >= 3 },
];

export function completeness(profile: ProfileChecklist) {
  const rows = items.map((item) => ({ key: item.key, label: item.label, done: item.done(profile) }));
  const done = rows.filter((row) => row.done).length;
  return { score: Math.round((done / rows.length) * 100), done, total: rows.length, rows };
}
