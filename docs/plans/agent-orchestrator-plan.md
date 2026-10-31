# Agent orchestrator plan

The owner-authored prompt files listed in `docs/prompts/README.md` are still not in the repo. This plan follows the orchestrator prompt, the short master context, and the code that is already here.

The purple screens stay. The configurator changes labels, module visibility, and dashboard wording through a config object. It does not generate components.

## Reuse

- Business types, nav, and module gates in `lib/business-types.ts` and `lib/use-workspace-nav.ts`.
- Qualification, consent, quiet hours, and the score in `server/outreach/` and `lib/lead-score.ts`. Messages stay `awaiting_provider` until a provider id exists.
- Payment and ledger rules in `server/finance.ts`. The model is not given SQL.
- Activity log and the agent-activity screen. New runs are added beside the demo rows and labeled as recorded.
- Feature flags in `server/flags.ts`. `FEATURE_AI` stays off until a key exists.

## Not reused as a second system

- `lib/workspace-context.tsx` loads the SQLite workspace API and redirects to login. The configurator does not mount it.
- Inngest is not connected. The same runner executes in this process. A hosted Inngest worker waits on the owner checklist.
- pgvector is not created. The embedding model’s output size is not fixed in the price page, so memory is stored as text until that size is confirmed.

## Model defaults

Checked on 31 Oct 2026:

- Google models: https://ai.google.dev/gemini-api/docs/models
- Google prices: https://ai.google.dev/gemini-api/docs/pricing (page updated 30 Oct 2026)
- OpenAI prices: https://developers.openai.com/api/docs/pricing
- OpenAI models: https://developers.openai.com/api/docs/models

| Tier | Google | OpenAI |
| --- | --- | --- |
| FAST | `gemini-3.5-flash-lite` $0.30 / $2.50 | `gpt-6-luna` $0.10 / $0.50 under 272K |
| STANDARD | `gemini-3.8-flash` $0.75 / $3.75 through 31 Dec 2026, then $1.50 / $7.50 | `gpt-5.4-mini` $0.75 / $4.50 |
| ESCALATION | not set | `gpt-6.1-sol` $2 / $10, off unless the run is flagged |
| EMBED | `gemini-embedding-001` $0.15 | `text-embedding-3-small` $0.02 |

`gemini-3.8-flash` is the current Flash for new projects. Gemini 2.5 is limited to projects that already used it.

## Build order in this pass

1. Gateway, price table, redaction, and budget checks. No call leaves the server without `FEATURE_AI=1` and a key.
2. Events, runs, policy, and a rule-first runner. Proposals are not marked succeeded.
3. Workspace catalogs, validation, diff, apply, rollback, the assistant page, and 40 description checks.
4. Agent definitions for CRM, leads, marketing, commerce, finance, operations, and the brain. Each one proposes. Execution waits on a provider.

Domain agents do not call a model when a rule already decided the action.
