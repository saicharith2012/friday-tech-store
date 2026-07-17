import { test, expect } from "bun:test";
import { executeTool, customerId } from "./tools";

test("tool allowlist and strict validation", () => {
  expect(() => executeTool("toString", "{}", customerId)).toThrow();
  expect(() =>
    executeTool("getOrderDetails", '{"orderId":1}', customerId),
  ).toThrow();
  expect(() =>
    executeTool("getReturnPolicy", '{"customerId":"other"}', customerId),
  ).toThrow();
});

test("ownership enforced outside the model", () => {
  expect(() =>
    executeTool("getOrderDetails", '{"orderId":"ORD-1001"}', "other"),
  ).toThrow();
  expect(
    executeTool("getOrderDetails", '{"orderId":"ORD-1001"}', customerId),
  ).toHaveProperty("status", "delivered");
});
