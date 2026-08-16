import { supabaseAdmin } from "../supabase.js";

export async function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Missing access token." });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid or expired access token." });
  req.user = data.user;
  next();
}

export async function requireAdmin(req, res, next) {
  await requireUser(req, res, async () => {
    const { data } = await supabaseAdmin.from("profiles").select("role").eq("id", req.user.id).single();
    if (data?.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    next();
  });
}
