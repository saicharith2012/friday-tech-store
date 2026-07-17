import { expect, test, spyOn } from "bun:test";
import { customerId } from "./tools";
import { chat } from "./agent";
import type { complete } from "./llm";

const reply: Awaited<ReturnType<typeof complete>> = {
  role: "assistant",
  content: "Hello",
  refusal: null,
};

test("direct reply and history", async () => {
  const first = await chat({ message: "Hi" }, customerId, async () => reply);
  expect(first.status).toBe("completed");
  await chat(
    { message: "Again", conversationId: first.conversationId },
    customerId,
    async (messages) => {
      expect(messages.some((message) => message.content === "Hi")).toBe(true);

      return reply;
    },
  );
});

test("five-call budget and observations", async () => {
  let calls = 0;
  const result = await chat(
    { message: "Loop" },
    customerId,
    async (messages) => {
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
    },
  );
  expect(calls).toBe(5);
  expect(result.status).toBe("needs_escalation");
});

test("provider failure escalates", async () => {
  expect(
    (
      await chat({ message: "Hi" }, customerId, async () => {
        throw new Error("offline");
      })
    ).status,
  ).toBe("needs_escalation");
});

test("ticket requires confirmation and replay is idempotent", async () => {
  const proposal = await chat({ message: "Help" }, customerId, async () => ({
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
  const confirmed = await chat(input, customerId);
  expect(confirmed.status).toBe("completed");
  expect((await chat(input, customerId)).reply).toContain("already recorded");
});

test("cumulative budget rejects later valid tools after failed attempts", async () => {
  let iteration = 0;
  const result = await chat(
    { message: "Budget" },
    customerId,
    async (messages) => {
      iteration++;

      if (iteration === 3) {
        const observations = messages.filter(
          (message) => message.role === "tool",
        );
        expect(observations).toHaveLength(6);
        expect(
          JSON.parse(observations.at(-1)!.content as string),
        ).toHaveProperty("error");

        return reply;
      }

      return {
        ...reply,
        content: null,
        tool_calls: Array.from({ length: 3 }, (_, index) => ({
          id: `${iteration}-${index}`,
          type: "function" as const,
          function: {
            name: iteration === 1 ? "unknown" : "getReturnPolicy",
            arguments: "{}",
          },
        })),
      };
    },
  );
  expect(result.status).toBe("completed");
});

test("foreign customers cannot access conversations", async () => {
  const first = await chat({ message: "Hello" }, customerId, async () => reply);
  await expect(
    chat(
      { message: "Read", conversationId: first.conversationId },
      "other",
      async () => reply,
    ),
  ).rejects.toThrow("Conversation unavailable");
});

test("oversized model responses are rejected", async () => {
  const result = await chat({ message: "Large" }, customerId, async () => ({
    ...reply,
    content: "x".repeat(9000),
  }));
  expect(result.status).toBe("needs_escalation");
});

test("history stays under the context byte cap", async () => {
  let conversationId: string | undefined;

  for (let index = 0; index < 22; index++) {
    const result = await chat(
      { message: "x".repeat(4000), conversationId },
      customerId,
      async (messages) => {
        expect(
          new TextEncoder().encode(JSON.stringify(messages)).byteLength,
        ).toBeLessThanOrEqual(64 * 1024);

        return { ...reply, content: "y".repeat(4000) };
      },
    );
    conversationId = result.conversationId;
  }
});

test("confirmation is owned, replaced, and expires", async () => {
  const propose: typeof complete = async () => ({
    ...reply,
    content: null,
    tool_calls: [
      {
        id: "proposal",
        type: "function",
        function: {
          name: "createSupportTicket",
          arguments: JSON.stringify({
            subject: "Exact subject",
            description: "Exact description",
          }),
        },
      },
    ],
  });
  const first = await chat({ message: "Ticket" }, customerId, propose);
  expect(first.pendingConfirmation?.ticket).toEqual({
    subject: "Exact subject",
    description: "Exact description",
  });
  const input = {
    message: "Confirm",
    conversationId: first.conversationId,
    confirmationId: first.pendingConfirmation!.id,
  };
  await expect(chat(input, "other")).rejects.toThrow(
    "Conversation unavailable",
  );
  const second = await chat(
    { message: "Replace", conversationId: first.conversationId },
    customerId,
    propose,
  );
  await expect(chat(input, customerId)).rejects.toThrow("Invalid confirmation");
  const clock = spyOn(Date, "now").mockReturnValue(
    Date.parse(second.pendingConfirmation!.expiresAt),
  );

  try {
    await expect(
      chat(
        { ...input, confirmationId: second.pendingConfirmation!.id },
        customerId,
      ),
    ).rejects.toThrow("Confirmation expired");
  } finally {
    clock.mockRestore();
  }
});
