import { z } from "zod";

export const customerId = "customer-demo";

const orders = [
  {
    id: "ORD-1001",
    customerId,
    product: "Laptop",
    status: "delivered",
    warrantyMonths: 12,
  },
];

const schemas = {
  getOrderDetails: z.strictObject({ orderId: z.string().min(1) }),
  getReturnPolicy: z.strictObject({}),
  getWarrantyInfo: z.strictObject({ orderId: z.string().min(1) }),
  createSupportTicket: z.strictObject({
    subject: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
  }),
};

export const definitions = Object.entries(schemas).map(([name, schema]) => ({
  type: "function" as const,
  function: {
    name,
    description:
      name === "createSupportTicket"
        ? "Request a support ticket; requires customer confirmation."
        : name,
    parameters: z.toJSONSchema(schema),
  },
}));

export interface Ticket {
  subject: string;
  description: string;
}

type ToolResult =
  | { days: number; conditions: string }
  | { confirmationRequired: true; ticket: Ticket }
  | (typeof orders)[number]
  | { product: string; warrantyMonths: number };

export function executeTool(
  name: string,
  raw: string,
  owner: string,
): ToolResult {
  if (!Object.hasOwn(schemas, name)) {
    throw new Error("Unknown tool");
  }

  const args = schemas[name as keyof typeof schemas].parse(JSON.parse(raw));

  if (name === "getReturnPolicy") {
    return {
      days: 30,
      conditions:
        "Return within 30 days in original condition. Contact support to arrange a return.",
    };
  }

  if (name === "createSupportTicket") {
    return {
      confirmationRequired: true,
      ticket: schemas.createSupportTicket.parse(args),
    };
  }

  const order = orders.find(
    (o) =>
      o.id === (args as { orderId: string }).orderId && o.customerId === owner,
  );

  if (!order) {
    throw new Error("Order unavailable");
  }

  return name === "getWarrantyInfo"
    ? { product: order.product, warrantyMonths: order.warrantyMonths }
    : order;
}
