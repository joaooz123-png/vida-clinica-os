import { supabase } from "@/integrations/supabase/client";
import { KnowledgeArticle, knowledgeArticles } from "@/lib/knowledgeBase";

export type KnowledgeArticleRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  content: string;
  tags: string[];
  source_url: string | null;
  visibility: "public" | "authenticated" | "admin" | string;
  status: "draft" | "published" | "archived" | string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeArticleInput = {
  id?: string;
  title: string;
  slug: string;
  category: string;
  summary?: string | null;
  content: string;
  tags?: string[];
  source_url?: string | null;
  visibility?: "public" | "authenticated" | "admin";
  status?: "draft" | "published" | "archived";
};

function estimateReadingMinutes(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 90);
}

export function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function rowToArticle(row: KnowledgeArticleRow): KnowledgeArticle {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    summary: row.summary || "",
    tags: row.tags || [],
    updatedAt: row.updated_at,
    readingMinutes: estimateReadingMinutes(row.content),
    content: row.content,
  };
}

export async function fetchPublishedKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  const { data, error } = await (supabase as any)
    .from("knowledge_articles")
    .select("id,title,slug,category,summary,content,tags,source_url,visibility,status,created_by,updated_by,created_at,updated_at")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data || []) as KnowledgeArticleRow[]).map(rowToArticle);
}

export async function fetchKnowledgeArticleBySlug(slug: string): Promise<KnowledgeArticle | null> {
  const { data, error } = await (supabase as any)
    .from("knowledge_articles")
    .select("id,title,slug,category,summary,content,tags,source_url,visibility,status,created_by,updated_by,created_at,updated_at")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("visibility", "public")
    .maybeSingle();

  if (error) throw error;
  return data ? rowToArticle(data as KnowledgeArticleRow) : null;
}

export async function fetchAllKnowledgeArticlesForAdmin(): Promise<KnowledgeArticleRow[]> {
  const { data, error } = await (supabase as any)
    .from("knowledge_articles")
    .select("id,title,slug,category,summary,content,tags,source_url,visibility,status,created_by,updated_by,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []) as KnowledgeArticleRow[];
}

export async function upsertKnowledgeArticle(input: KnowledgeArticleInput) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const now = new Date().toISOString();

  const payload = {
    id: input.id,
    title: input.title.trim(),
    slug: normalizeSlug(input.slug || input.title),
    category: input.category.trim() || "general",
    summary: input.summary?.trim() || null,
    content: input.content,
    tags: input.tags || [],
    source_url: input.source_url?.trim() || null,
    visibility: input.visibility || "public",
    status: input.status || "draft",
    updated_by: userId,
    updated_at: now,
    ...(input.id ? {} : { created_by: userId, created_at: now }),
  };

  const { data, error } = await (supabase as any)
    .from("knowledge_articles")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data as KnowledgeArticleRow;
}

export async function archiveKnowledgeArticle(id: string) {
  const { error } = await (supabase as any)
    .from("knowledge_articles")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export function mergeRemoteWithStatic(remote: KnowledgeArticle[]) {
  const bySlug = new Map<string, KnowledgeArticle>();
  [...remote, ...knowledgeArticles].forEach((article) => {
    if (!bySlug.has(article.slug)) bySlug.set(article.slug, article);
  });
  return Array.from(bySlug.values());
}
