import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/start-server-core";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const managedUserInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.enum(["student", "teacher", "parent"]),
  qualifications: z.string().optional(),
  parentEmail: z.string().email().optional(),
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

async function sendStudentCodeEmail({
  recipient,
  studentName,
  studentCode,
  studentEmail,
  setupLink,
}: {
  recipient: string;
  studentName: string;
  studentCode: string;
  studentEmail: string;
  setupLink: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error(
      "Student account was created, but email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM on the server.",
    );
  }

  const safeStudentName = escapeHtml(studentName);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `EduBridge student link code for ${studentName}`,
      text: [
        `Hello,`,
        ``,
      `The EduBridge account for ${studentName} is ready. Student sign-in email: ${studentEmail}`,
      `Set a password using this secure link: ${setupLink}`,
        `Student code: ${studentCode}`,
        ``,
        `Sign in to the Parent portal, open My children, and enter this code to link the student to your account.`,
      ].join("\n"),
      html: `<p>Hello,</p><p>The EduBridge account for <strong>${safeStudentName}</strong> is ready.</p><p>Student sign-in email: <strong>${escapeHtml(studentEmail)}</strong></p><p><a href="${escapeHtml(setupLink)}">Set the student's password securely</a></p><p>Student code: <strong style="font-family:monospace;font-size:1.25rem">${studentCode}</strong></p><p>Sign in to the Parent portal, open <strong>My children</strong>, and enter this code to link the student to your account.</p>`,
    }),
  });

  if (!response.ok) {
    console.error("[EduBridge] Student code email delivery failed", {
      status: response.status,
    });
    throw new Error(
      `Student account was created, but the code email could not be sent (email provider returned ${response.status}).`,
    );
  }
}

async function sendAccountSetupEmail({ recipient, name, role, setupLink }: {
  recipient: string;
  name: string;
  role: string;
  setupLink: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Account email is not configured on the server.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: "Set up your EduBridge account",
      text: `Hello ${name},\n\nYour ${role} account is ready. Set your password using this secure, single-use link:\n${setupLink}\n\nFor your security, EduBridge does not send passwords by email.`,
      html: `<p>Hello ${escapeHtml(name)},</p><p>Your ${escapeHtml(role)} account is ready.</p><p><a href="${escapeHtml(setupLink)}">Set your EduBridge password</a></p><p>This is a secure setup link. EduBridge does not send passwords by email.</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Account email delivery failed (email provider returned ${response.status}).`);
}

export const createManagedUser = createServerFn({ method: "POST" })
  .validator(managedUserInput)
  .handler(async ({ data }) => {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      throw new Error("Account email is not configured. Set RESEND_API_KEY and EMAIL_FROM as Cloudflare runtime secrets before creating accounts.");
    }
    const authorization = getRequestHeader("authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Administrator authentication is required");

    const { data: requester, error: requesterError } = await supabaseAdmin.auth.getUser(token);
    if (requesterError || !requester.user)
      throw new Error("Administrator authentication is invalid");

    const { data: adminRole, error: adminRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requester.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (adminRoleError) throw adminRoleError;
    if (!adminRole) throw new Error("Only administrators can create accounts");

    let parentUserId: string | undefined;
    if (data.role === "student") {
      if (!data.parentEmail) {
        throw new Error("Choose the parent email address before creating a student account.");
      }

      const { data: parentAccounts, error: parentAccountsError } =
        await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (parentAccountsError) throw parentAccountsError;

      const parent = parentAccounts.users.find(
        (candidate) => candidate.email?.toLowerCase() === data.parentEmail!.toLowerCase(),
      );
      if (!parent) {
        throw new Error(
          "No account uses that parent email. Create the parent account first, then create the student.",
        );
      }

      const { data: parentRole, error: parentRoleError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", parent.id)
        .eq("role", "parent")
        .maybeSingle();
      if (parentRoleError) throw parentRoleError;
      if (!parentRole) {
        throw new Error("The selected email does not belong to an account with the parent role.");
      }

      parentUserId = parent.id;

    }

    const randomPasswordBytes = new Uint8Array(32);
    crypto.getRandomValues(randomPasswordBytes);
    const initialPassword = Array.from(randomPasswordBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createError || !created.user) throw createError ?? new Error("Account creation failed");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: data.role })
      .eq("user_id", created.user.id);
    if (roleError) throw roleError;

    let studentCode: string | undefined;
    if (data.role === "student") {
      let profileUpdated = false;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const bytes = new Uint8Array(4);
        crypto.getRandomValues(bytes);
        const code = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase();

        const { data: updatedProfile, error: codeError } = await supabaseAdmin
          .from("profiles")
          .update({ student_code: code })
          .eq("id", created.user.id)
          .select("id")
          .maybeSingle();

        if (!codeError && updatedProfile) {
          studentCode = code;
          profileUpdated = true;
          break;
        }
        if (!codeError) {
          throw new Error("The student profile was not created with the account.");
        }
        if (codeError.code !== "23505") throw codeError;
      }

      if (!profileUpdated || !studentCode) {
        throw new Error(
          "The student account was created, but a unique student code could not be assigned.",
        );
      }
    }

    if (data.role === "teacher" && data.qualifications?.trim()) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ teacher_qualifications: data.qualifications.trim() })
        .eq("id", created.user.id);
      if (profileError) throw profileError;
    }

    if (data.role === "student" && parentUserId && data.parentEmail && studentCode) {
      try {
        const setup = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: data.email,
          options: { redirectTo: `${process.env.APP_URL || "https://edubridge-1dn.pages.dev"}/reset-password` },
        });
        if (setup.error || !setup.data.properties.action_link) throw setup.error ?? new Error("Could not create password setup link");
        await sendStudentCodeEmail({
          recipient: data.parentEmail,
          studentName: data.fullName,
          studentCode,
          studentEmail: data.email,
          setupLink: setup.data.properties.action_link,
        });
        return {
          id: created.user.id,
          studentCode,
          emailSent: true,
          parentEmail: data.parentEmail,
        };
      } catch (error) {
        return {
          id: created.user.id,
          studentCode,
          emailSent: false,
          parentEmail: data.parentEmail,
          emailError:
            error instanceof Error ? error.message : "Student code email delivery failed.",
        };
      }
    }

    try {
      const setup = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
        options: { redirectTo: `${process.env.APP_URL || "https://edubridge-1dn.pages.dev"}/reset-password` },
      });
      if (setup.error || !setup.data.properties.action_link) throw setup.error ?? new Error("Could not create password setup link");
      await sendAccountSetupEmail({
        recipient: data.email,
        name: data.fullName,
        role: data.role,
        setupLink: setup.data.properties.action_link,
      });
      return { id: created.user.id, emailSent: true };
    } catch (error) {
      return {
        id: created.user.id,
        emailSent: false,
        emailError: error instanceof Error ? error.message : "Account created but setup email could not be sent.",
      };
    }
  });
