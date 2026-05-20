import { supabase } from "@/integrations/supabase/client";
import { KnowledgeArticle, knowledgeArticles } from "@/lib/knowledgeBase";

export type KnowledgeStatus = "draft" | "pending_review" | "needs_revision" | "published" | "rejected" | "archived";
export type KnowledgeVisibility = "public" | "authenticated" | "admin";
export type EvidenceLevel =
  | "unrated"
  | "case_experience"
  | "expert_consensus"
  | "observational_study"
  | "randomized_trial"
  | "guideline"
  | "systematic_review"
  | "meta_analysis"
  | "regulatory_source"
  | "other";
export type SubmissionStatus = "draft" | "submitted" | "auto_verified" | "approved" | "needs_revision" | "rejected" | "archived";
export type SubmissionType = "new_article" | "expansion" | "correction" | "revision";

export type KnowledgeSource = {
  title: string;
  url?: string;
  publisher?: string;
  year?: string;
  evidence?: EvidenceLevel;
};

export type KnowledgeArticleRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  content: string;
  tags: string[];
  source_url: string | null;
  visibility: KnowledgeVisibility | string;
  status: KnowledgeStatus | string;
  evidence_level?: EvidenceLevel | string | null;
  evidence_grade?: string | null;
  evidence_summary?: string | null;
  sources?: KnowledgeSource[] | null;
  reviewer_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  contribution_origin?: string | null;
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
  visibility?: KnowledgeVisibility;
  status?: KnowledgeStatus;
  evidence_level?: EvidenceLevel;
  evidence_grade?: string | null;
  evidence_summary?: string | null;
  sources?: KnowledgeSource[];
};

export type KnowledgeSubmissionRow = {
  id: string;
  target_article_id: string | null;
  submission_type: SubmissionType | string;
  title: string;
  slug: string | null;
  category: string;
  summary: string | null;
  content: string;
  tags: string[];
  source_url: string | null;
  visibility: KnowledgeVisibility | string;
  evidence_level: EvidenceLevel | string;
  evidence_grade: string | null;
  evidence_summary: string | null;
  sources: KnowledgeSource[];
  status: SubmissionStatus | string;
  contributor_id: string;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeSubmissionInput = {
  target_article_id?: string | null;
  submission_type: SubmissionType;
  title: string;
  slug?: string | null;
  category: string;
  summary?: string | null;
  content: string;
  tags?: string[];
  source_url?: string | null;
  visibility?: KnowledgeVisibility;
  evidence_level?: EvidenceLevel;
  evidence_grade?: string | null;
  evidence_summary?: string | null;
  sources?: KnowledgeSource[];
  status?: "draft" | "submitted";
};

const ARTICLE_SELECT =
  "id,title,slug,category,summary,content,tags,source_url,visibility,status,evidence_level,evidence_grade,evidence_summary,sources,reviewer_notes,reviewed_by,reviewed_at,contribution_origin,created_by,updated_by,created_at,updated_at";

const SUBMISSION_SELECT =
  "id,target_article_id,submission_type,title,slug,category,summary,content,tags,source_url,visibility,evidence_level,evidence_grade,evidence_summary,sources,status,contributor_id,reviewer_id,reviewer_notes,reviewed_at,created_at,updated_at";

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

export function parseSources(value: string): KnowledgeSource[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, url, publisher, year] = line.split("|").map((part) => part?.trim());
      return { title, url, publisher, year };
    });
}

export function sourcesToText(sources?: KnowledgeSource[] | null) {
  return (sources || [])
    .map((source) => [source.title, source.url, source.publisher, source.year].filter(Boolean).join(" | "))
    .join("\n");
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
    .select(ARTICLE_SELECT)
    .eq("status", "published")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data || []) as KnowledgeArticleRow[]).map(rowToArticle);
}

export async function fetchKnowledgeArticleBySlug(slug: string): Promise<KnowledgeArticle | null> {
  const { data, error } = await (supabase as any)
    .from("knowledge_articles")
    .select(ARTICLE_SELECT)
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
    .select(ARTICLE_SELECT)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []) as KnowledgeArticleRow[];
}

export async function fetchKnowledgeSubmissions(): Promise<KnowledgeSubmissionRow[]> {
  const { data, error } = await (supabase as any)
    .from("knowledge_article_submissions")
    .select(SUBMISSION_SELECT)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []) as KnowledgeSubmissionRow[];
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
    status: input.status || "pending_review",
    evidence_level: input.evidence_level || "unrated",
    evidence_grade: input.evidence_grade?.trim() || null,
    evidence_summary: input.evidence_summary?.trim() || null,
    sources: input.sources || [],
    updated_by: userId,
    updated_at: now,
    ...(input.id ? {} : { created_by: userId, created_at: now, contribution_origin: "direct_draft" }),
  };

  const { data, error } = await (supabase as any)
    .from("knowledge_articles")
    .upsert(payload, { onConflict: "id" })
    .select(ARTICLE_SELECT)
    .single();

  if (error) throw error;
  return data as KnowledgeArticleRow;
}

export async function submitKnowledgeContribution(input: KnowledgeSubmissionInput) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("É necessário estar autenticado para submeter conhecimento verificável.");

  const payload = {
    target_article_id: input.target_article_id || null,
    submission_type: input.submission_type,
    title: input.title.trim(),
    slug: input.slug ? normalizeSlug(input.slug) : normalizeSlug(input.title),
    category: input.category.trim() || "general",
    summary: input.summary?.trim() || null,
    content: input.content,
    tags: input.tags || [],
    source_url: input.source_url?.trim() || null,
    visibility: input.visibility || "public",
    evidence_level: input.evidence_level || "unrated",
    evidence_grade: input.evidence_grade?.trim() || null,
    evidence_summary: input.evidence_summary?.trim() || null,
    sources: input.sources || [],
    status: input.status || "submitted",
    contributor_id: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (supabase as any)
    .from("knowledge_article_submissions")
    .insert(payload)
    .select(SUBMISSION_SELECT)
    .single();

  if (error) throw error;
  return data as KnowledgeSubmissionRow;
}

export async function reviewKnowledgeSubmission(id: string, decision: "approved" | "needs_revision" | "rejected" | "archived", notes?: string) {
  const { data, error } = await (supabase as any).rpc("review_knowledge_submission", {
    p_submission_id: id,
    p_decision: decision,
    p_reviewer_notes: notes || null,
  });

  if (error) throw error;
  return data as string | null;
}

export async function archiveKnowledgeArticle(id: string, reason?: string) {
  const { error } = await (supabase as any).rpc("audit_archive_knowledge_article", {
    p_article_id: id,
    p_reason: reason || null,
  });

  if (error) throw error;
}

export function mergeRemoteWithStatic(remote: KnowledgeArticle[]) {
  const bySlug = new Map<string, KnowledgeArticle>();
  [...remote, ...knowledgeArticles].forEach((article) => {
    if (!bySlug.has(article.slug)) bySlug.set(article.slug, article);
  });
  return Array.from(bySlug.values());
}

export const evidenceLevelLabels: Record<EvidenceLevel, string> = {
  unrated: "Não classificado",
  case_experience: "Experiência/caso clínico",
  expert_consensus: "Consenso de especialistas",
  observational_study: "Estudo observacional",
  randomized_trial: "Ensaio randomizado",
  guideline: "Diretriz clínica",
  systematic_review: "Revisão sistemática",
  meta_analysis: "Metanálise",
  regulatory_source: "Fonte regulatória/oficial",
  other: "Outro",
};
