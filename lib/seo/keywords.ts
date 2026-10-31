const modifiers = ["near me", "best", "price"];

export function keywordUniverse(input: {
  services: string[];
  localities: string[];
  languages?: Array<"en" | "hi" | "kn">;
  limit?: number;
}) {
  const languages = input.languages?.length ? input.languages : ["en"];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (phrase: string) => {
    const clean = phrase.trim().replace(/\s+/g, " ");
    const key = clean.toLowerCase();
    if (!clean || seen.has(key) || out.length >= (input.limit ?? 50)) return;
    seen.add(key);
    out.push(clean);
  };
  for (const service of input.services) {
    for (const locality of input.localities) {
      push(`${service} in ${locality}`);
      for (const modifier of modifiers) push(`${modifier} ${service} in ${locality}`);
      if (languages.includes("hi")) push(`${service} ${locality} के पास`);
      if (languages.includes("kn")) push(`${service} ${locality} ಹತ್ತಿರ`);
    }
  }
  return out;
}
