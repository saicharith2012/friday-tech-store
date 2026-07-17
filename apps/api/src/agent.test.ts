import { expect, test } from "bun:test";
import { chat } from "./agent";
import type { complete } from "./llm";

const reply: Awaited<ReturnType<typeof complete>> = {
  role: "assistant",
  content: "Hello",
  refusal: null,
};

test("direct reply and history", async () => {
  const first = await chat({ message: "Hi" }, async () => reply);
  expect(first.status).toBe("completed");
  await chat(
    { message: "Again", conversationId: first.conversationId },
    async (messages) => {
      expect(messages.some((message) => message.content === "Hi")).toBe(true);

      return reply;
    },
  );
});

test("five-call budget and observations", async () => {
  let calls = 0;
  const result = await chat({ message: "Loop" }, async (messages) => {
    calls++;

    if (calls > 1) {
      expect(messages.at(-1)?.role).toBe("tool");
    }

    return {
      ...reply,
      content: null,
      tool_calls: [
        {
          id: `call-${calls}`,
          type: "function",
          function: { name: "unknown", arguments: "{}" },
        },
      ],
    };
  });
  expect(calls).toBe(5);
  expect(result.status).toBe("escalated");
});

test("provider failure escalates", async () => {
  expect(
    (
      await chat({ message: "Hi" }, async () => {
        throw new Error("offline");
      })
    ).status,
  ).toBe("escalated");
});

test("ticket requires confirmation and replay is idempotent", async () => {
  const proposal = await chat({ message: "Help" }, async () => ({
    ...reply,
    content: null,
    tool_calls: [
      {
        id: "ticket",
        type: "function",
        function: {
          name: "createSupportTicket",
          arguments: JSON.stringify({
            subject: "Help",
            description: "Broken laptop",
          }),
        },
      },
    ],
  }));
  expect(proposal.status).toBe("confirmation_required");
  const input = {
    message: "Confirm",
    conversationId: proposal.conversationId,
    confirmationId: proposal.pendingConfirmation!.id,
  };
  const confirmed = await chat(input);
  expect(confirmed.status).toBe("completed");
  expect((await chat(input)).reply).toContain("already created");
});
