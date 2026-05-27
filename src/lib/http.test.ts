import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserTenant: vi.fn(),
  plaidItemFindFirst: vi.fn(),
  snapTradeConnectionFindFirst: vi.fn(),
  snapTradePositionFindFirst: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/tenant", () => ({
  getUserTenant: mocks.getUserTenant,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plaidItem: {
      findFirst: mocks.plaidItemFindFirst,
    },
    snapTradeConnection: {
      findFirst: mocks.snapTradeConnectionFindFirst,
    },
    snapTradePosition: {
      findFirst: mocks.snapTradePositionFindFirst,
    },
  },
}));

import {
  parseJson,
  requireOwnedPlaidItem,
  requireOwnedSnapTradeConnection,
  requireOwnedSnapTradeLogo,
  requireUserTenant,
} from "@/lib/http";
import { z } from "zod";

const session = { user: { id: "user_1" } };
const tenant = { id: "tenant_1", slug: "personal" };

describe("HTTP auth and tenant guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(session);
    mocks.getUserTenant.mockResolvedValue(tenant);
  });

  it("requires an authenticated session before resolving a tenant", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const result = await requireUserTenant();

    if (!("error" in result)) {
      throw new Error("Expected an unauthorized error response.");
    }
    const { error } = result;
    if (!error) throw new Error("Expected an error response.");
    expect(error.status).toBe(401);
    expect(mocks.getUserTenant).not.toHaveBeenCalled();
  });

  it("looks up Plaid items inside the authenticated tenant", async () => {
    mocks.plaidItemFindFirst.mockResolvedValue({ id: "item_1", tenantId: tenant.id });

    const result = await requireOwnedPlaidItem("item_1");

    expect(mocks.plaidItemFindFirst).toHaveBeenCalledWith({
      where: {
        id: "item_1",
        tenantId: tenant.id,
      },
      include: {
        tenant: true,
      },
    });
    expect("item" in result).toBe(true);
  });

  it("does not return Plaid items outside the authenticated tenant", async () => {
    mocks.plaidItemFindFirst.mockResolvedValue(null);

    const result = await requireOwnedPlaidItem("item_from_other_tenant");

    expect(mocks.plaidItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "item_from_other_tenant",
          tenantId: tenant.id,
        },
      })
    );
    if (!("error" in result)) {
      throw new Error("Expected a not found error response.");
    }
    const { error } = result;
    if (!error) throw new Error("Expected an error response.");
    expect(error.status).toBe(404);
  });

  it("looks up SnapTrade connections inside the authenticated tenant", async () => {
    mocks.snapTradeConnectionFindFirst.mockResolvedValue({
      id: "connection_1",
      tenantId: tenant.id,
    });

    const result = await requireOwnedSnapTradeConnection("connection_1");

    expect(mocks.snapTradeConnectionFindFirst).toHaveBeenCalledWith({
      where: {
        id: "connection_1",
        tenantId: tenant.id,
      },
    });
    expect("connection" in result).toBe(true);
  });

  it("looks up SnapTrade logos through tenant-owned positions", async () => {
    mocks.snapTradePositionFindFirst.mockResolvedValue({ id: "position_1" });

    const result = await requireOwnedSnapTradeLogo("logo_1");

    expect(mocks.snapTradePositionFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: tenant.id,
        logoId: "logo_1",
      },
      select: { id: true },
    });
    expect("logoId" in result).toBe(true);
  });
});

describe("parseJson", () => {
  const schema = z.object({
    name: z.string().min(1),
    amount: z.number().positive(),
  });

  it("returns typed data for valid JSON", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ name: "Rent", amount: 100 }),
    });

    const result = await parseJson(request, schema);

    expect(result).toEqual({ data: { name: "Rent", amount: 100 } });
  });

  it("returns a 400 response for malformed JSON", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: "{",
    });

    const result = await parseJson(request, schema);

    if (!("error" in result)) {
      throw new Error("Expected an invalid body response.");
    }
    expect(result.error.status).toBe(400);
  });

  it("returns a 400 response for schema validation failures", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ name: "", amount: -1 }),
    });

    const result = await parseJson(request, schema);

    if (!("error" in result)) {
      throw new Error("Expected an invalid body response.");
    }
    expect(result.error.status).toBe(400);
  });

  it("allows empty optional bodies", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: "",
    });

    const result = await parseJson(request, schema.optional(), { allowEmpty: true });

    expect(result).toEqual({ data: undefined });
  });
});
