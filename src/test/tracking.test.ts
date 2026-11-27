import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { getPublicTracking } from "@/lib/tracking";

describe("Existing tracking token lookup", () => {
  beforeEach(() => rpc.mockReset());
  it("uses the existing token and only the public-safe RPC", async () => {
    const token = "11111111-2222-4333-8444-555555555555";
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getPublicTracking({ data: { token } })).toBeNull();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("public_track_packing_list", { _token: token });
  });
  it("rejects an invalid code without querying data", async () => {
    expect(await getPublicTracking({ data: { token: "not-a-code" } })).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});