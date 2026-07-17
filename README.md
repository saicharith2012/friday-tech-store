# Friday customer support agent

Minimal Bun + TypeScript Express service with DeepSeek tool calling through the OpenAI SDK. The Next.js workspace is unchanged.

## Setup

Install Bun, then run from the repository root:

```sh
bun install
cp apps/api/.env.example apps/api/.env
# Set DEEPSEEK_API_KEY and a random DEMO_API_TOKEN (at least 16 characters).
bun run dev --filter=api
```

Bun loads the API workspace environment automatically. `DEEPSEEK_MODEL` defaults to `deepseek-chat`; choose a DeepSeek model supporting non-thinking tool calling. Never commit credentials.

## Try it

```sh
curl http://localhost:3001/api/v1/chat \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_DEMO_API_TOKEN' \
  -d '{"message":"Where is order ORD-1001?"}'
```

Include the returned `conversationId` in subsequent requests. To create a ticket, ask for one, review `pendingConfirmation.ticket`, then send the same conversation ID, a message, and its `confirmationId`. Confirmation expires after ten minutes (see `expiresAt`) and records exactly the displayed mock ticket in memory; repeated confirmation returns its existing ticket ID. `GET /` lists routes; `GET /api/v1/health` checks health.

## Implementation decisions

`server.ts` starts Express; `agent.ts` owns the five-call loop and in-memory histories; `tools.ts` defines the explicit tool registry and strict Zod schemas; `llm.ts` configures DeepSeek with a 30-second timeout and no automatic retries. Existing route handlers handle HTTP validation and authentication.

Tool failures become observations so the model can recover. Only four tool execution attempts across the entire request are allowed, including failed attempts. Excess calls receive error observations. Ownership checks and ticket consent live in code rather than prompts. Unknown tools cannot execute. Budget exhaustion and provider failures return an escalation message without claiming to have contacted a human.

The HTTP handler maps the bearer token to one fixed demo customer and passes this identity to the agent. This shared token cannot distinguish real customers; production requires authenticated per-customer identity. ORD-1001 is that customer's mocked delivered laptop with a 12-month warranty; returns allow 30 days in original condition. All results and ticket IDs are mocks; no human is notified. `needs_escalation` means help is needed; `escalated` is reserved for a future recorded handoff. Histories retain at most 20 complete turns and 64 KiB of serialized UTF-8 message JSON, evicting oldest complete turns. Responses over 8 KiB are rejected before tools execute. Oversized current turns are not retained. This is not a token budget; token counting and summarization remain deferred. Overlapping turns receive 409. Restarting loses all conversations and tickets. Sessions have no expiry; this is a local demo, not production authentication or durable support delivery.

## Validation

```sh
bun run --cwd apps/api test
bun run check-types
```

Tests check tool validation and ownership without network access. Use the curl request above with a real DeepSeek key for a live smoke test. Responses expose `completed`, `confirmation_required`, or `needs_escalation` status. No database, queue, or LangChain is required.

API review checks: `bun run --cwd apps/api lint`, `bun run --cwd apps/api format:check`, and `bun run --cwd apps/api test`. Use `format` to apply Prettier formatting. The API uses TypeScript 6 for compatibility with TypeScript ESLint; other workspaces retain their existing compiler.
