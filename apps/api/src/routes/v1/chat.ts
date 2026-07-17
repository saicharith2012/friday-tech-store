import type { RequestHandler } from "express";
import { z } from "zod";
import { env } from "../../env";
import { customerId } from "../../tools";
import { chat, ChatError } from "../../agent";

const schema = z.strictObject({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.uuid().optional(),
  confirmationId: z.uuid().optional(),
});

export const chatHandler: RequestHandler = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${env.DEMO_API_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized" });

    return;
  }

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });

    return;
  }

  try {
    res.json(await chat(parsed.data, customerId));
  } catch (error) {
    res.status(error instanceof ChatError ? error.status : 500).json({
      error: error instanceof ChatError ? error.message : "Service unavailable",
    });
  }
};
