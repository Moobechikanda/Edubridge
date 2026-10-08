import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/start-server-core";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const managedUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  role: z.enum(["student", "teacher", "parent"]),
  qualifications: z.string().optional(),
});

export const createManagedUser = createServerFn({ method: "POST" })
  .validator(managedUserInput)
  .handler(async ({ data }) => {
    const authorization = getRequestHeader("authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Administrator authentication is required");

    const { data: requester, error: requesterError } = await supabaseAdmin.auth.getUser(token);
    if (requesterError || !requester.user) throw new Error("Administrator authentication is invalid");

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Only administrators can create accounts");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createError || !created.user) throw createError ?? new Error("Account creation failed");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: data.role })
      .eq("user_id", created.user.id);
    if (roleError) throw roleError;

    if (data.role === "teacher" && data.qualifications?.trim()) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ teacher_qualifications: data.qualifications.trim() })
        .eq("id", created.user.id);
      if (profileError) throw profileError;
    }

    return { id: created.user.id };
  });
