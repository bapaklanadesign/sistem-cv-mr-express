import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateNewUser, type ManagedUser } from "./user-validation";

const role = z.enum(["super_admin", "admin1", "admin2", "admin_packing"]);
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("create"), email: z.string(), password: z.string(), fullName: z.string(), role }),
  z.object({ action: z.literal("update"), id: z.string().uuid(), email: z.string(), fullName: z.string(), role }),
  z.object({ action: z.literal("active"), id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal("reset"), id: z.string().uuid(), password: z.string().min(10).max(72) }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

export const manageUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: z.infer<typeof input>) => input.parse(value))
  .handler(async ({ data, context }): Promise<{ id: string | null; users: ManagedUser[] }> => {
    const check = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (check.error || !check.data) throw new Error("Hanya Super Admin yang dapat mengelola akun");
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const audit = async (action: string, id: string, before: Record<string, string | null> | null = null, after: Record<string, string | null> = {}) => {
      const r = await admin.from("audit_logs").insert({ actor_id: context.userId, action, before_data: before, after_data: { ...after, user_id: id } });
      if (r.error) throw new Error("Perubahan tersimpan tetapi riwayat gagal dicatat");
    };
    if (data.action === "list") {
      const [profiles, roles] = await Promise.all([admin.from("profiles").select("id,full_name"), admin.from("user_roles").select("user_id,role,disabled_at")]);
      if (profiles.error || roles.error) throw new Error("Tidak dapat memuat pengguna");
      const users: ManagedUser[] = [];
      for (let page = 1; ; page++) {
        const r = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (r.error) throw new Error(r.error.message);
        for (const user of r.data.users) {
          const rr = roles.data.find((r) => r.user_id === user.id);
          users.push({ id: user.id, email: user.email ?? "", full_name: profiles.data.find((p) => p.id === user.id)?.full_name ?? "", role: rr?.role ?? null,
            active: !rr?.disabled_at && (!user.banned_until || Date.parse(user.banned_until) <= Date.now()), last_sign_in_at: user.last_sign_in_at ?? null, created_at: user.created_at });
        }
        if (r.data.users.length < 1000) break;
      }
      return { id: null, users };
    }
    if (data.action === "create") {
      const u = validateNewUser(data);
      if (u.role === "admin1" || u.role === "admin2") {
        const existing = await admin.from("user_roles").select("id").eq("role", u.role).maybeSingle();
        if (existing.error || existing.data) throw new Error("Akun untuk peran laporan ini sudah ada");
      }
      const r = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true, user_metadata: { full_name: u.fullName } });
      if (r.error || !r.data.user) throw new Error(r.error?.message ?? "Akun gagal dibuat");
      const id = r.data.user.id;
      const assigned = await context.supabase.rpc("set_managed_role", { p_user_id: id, p_role: u.role });
      if (assigned.error) { await admin.auth.admin.deleteUser(id); throw new Error(assigned.error.message); }
      await audit("user_create", id, null, { email: u.email, full_name: u.fullName, role: u.role });
      return { id, users: [] };
    }
    const target = await admin.auth.admin.getUserById(data.id);
    if (target.error || !target.data.user) throw new Error("Akun tidak ditemukan");
    const previousRole = await admin.from("user_roles").select("role,disabled_at").eq("user_id", data.id).maybeSingle();
    if (previousRole.error) throw new Error(previousRole.error.message);
    const previous = { email: target.data.user.email ?? "", full_name: String(target.data.user.user_metadata["full_name"] ?? ""), role: previousRole.data?.role ?? null };
    if (data.action === "update") {
      const u = validateNewUser({ ...data, password: "x".repeat(10) });
      if (data.id === context.userId && u.role !== previousRole.data?.role) throw new Error("Anda tidak dapat mengubah peran akun sendiri");
      const assigned = await context.supabase.rpc("set_managed_role", { p_user_id: data.id, p_role: u.role });
      if (assigned.error) throw new Error(assigned.error.message);
      const changed = await admin.auth.admin.updateUserById(data.id, { email: u.email, user_metadata: { full_name: u.fullName } });
      if (changed.error) {
        if (previousRole.data) await context.supabase.rpc("set_managed_role", { p_user_id: data.id, p_role: previousRole.data.role });
        throw new Error(changed.error.message);
      }
      const profile = await admin.from("profiles").update({ full_name: u.fullName, email: u.email }).eq("id", data.id);
      if (profile.error) throw new Error(profile.error.message);
      await audit("user_update", data.id, previous, { email: u.email, full_name: u.fullName, role: u.role });
    } else if (data.action === "active") {
      if (data.id === context.userId && !data.active) throw new Error("Anda tidak dapat menonaktifkan akun sendiri");
      const disabled = await admin.from("user_roles").update({ disabled_at: data.active ? null : new Date().toISOString() }).eq("user_id", data.id);
      if (disabled.error) throw new Error(disabled.error.message);
      const r = await admin.auth.admin.updateUserById(data.id, { ban_duration: data.active ? "none" : "876000h" });
      if (r.error) {
        await admin.from("user_roles").update({ disabled_at: previousRole.data?.disabled_at ?? null }).eq("user_id", data.id);
        throw new Error(r.error.message);
      }
      await audit(data.active ? "user_enable" : "user_disable", data.id);
    } else if (data.action === "reset") {
      const r = await admin.auth.admin.updateUserById(data.id, { password: data.password });
      if (r.error) throw new Error(r.error.message);
      await audit("user_reset_password", data.id);
    } else {
      if (data.id === context.userId) throw new Error("Anda tidak dapat menghapus akun sendiri");
      const r = await admin.auth.admin.deleteUser(data.id);
      if (r.error) throw new Error(r.error.message);
      await audit("user_delete", data.id, previous);
    }
    return { id: data.id, users: [] };
  });

export const finishInitialSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const user = await context.supabase.auth.getUser();
    if (user.error || !user.data.user?.email_confirmed_at) throw new Error("Verifikasi email terlebih dahulu");
    const r = await context.supabase.rpc("claim_initial_admin");
    if (r.error) throw new Error(r.error.message);
    return { id: context.userId };
  });