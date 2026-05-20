import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Edit3, FileCheck2, Loader2, Plus, Save, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EvidenceLevel,
  KnowledgeArticleRow,
  KnowledgeSubmissionRow,
  archiveKnowledgeArticle,
  evidenceLevelLabels,
  fetchAllKnowledgeArticlesForAdmin,
  fetchKnowledgeSubmissions,
  normalizeSlug,
  parseSources,
  parseTags,
  reviewKnowledgeSubmission,
  sourcesToText,
  submitKnowledgeContribution,
  upsertKnowledgeArticle,
} from "@/lib/knowledgeSupabase";

type FormState = {
  id?: string;
  target_article_id?: string | null;
  submission_type: "new_article" | "expansion" | "correction" | "revision";
  title: string;
  slug: string;
  category: string;
  summary: string;
  content: string;
  tags: string;
  source_url: string;
  visibility: "public" | "authenticated" | "admin";
  status: "draft" | "pending_review" | "needs_revision" | "published" | "rejected" | "archived";
  evidence_level: EvidenceLevel;
  evidence_grade: string;
  evidence_summary: string;
  sources: string;
};

const EMPTY_FORM: FormState = {
  target_article_id: null,
  submission_type: "new_article",
  title: "",
  slug: "",
  category: "UHS Health OS",
  summary: "",
  content: "# Nova contribuição\n\nEscreva aqui em Markdown. Inclua raciocínio, limites, fontes e aplicação prática.",
  tags: "uhs, protocolo-vida",
  source_url: "",
  visibility: "public",
  status: "pending_review",
  evidence_level: "unrated",
  evidence_grade: "",
  evidence_summary: "",
  sources: "",
};

function articleToForm(row: KnowledgeArticleRow): FormState {
  return {
    id: row.id,
    target_article_id: row.id,
    submission_type: "revision",
    title: row.title,
    slug: row.slug,
    category: row.category,
    summary: row.summary || "",
    content: row.content,
    tags: (row.tags || []).join(", "),
    source_url: row.source_url || "",
    visibility: (row.visibility as FormState["visibility"]) || "public",
    status: (row.status as FormState["status"]) || "pending_review",
    evidence_level: (row.evidence_level as EvidenceLevel) || "unrated",
    evidence_grade: row.evidence_grade || "",
    evidence_summary: row.evidence_summary || "",
    sources: sourcesToText(row.sources),
  };
}

function submissionToForm(row: KnowledgeSubmissionRow): FormState {
  return {
    target_article_id: row.target_article_id,
    submission_type: row.submission_type as FormState["submission_type"],
    title: row.title,
    slug: row.slug || "",
    category: row.category,
    summary: row.summary || "",
    content: row.content,
    tags: (row.tags || []).join(", "),
    source_url: row.source_url || "",
    visibility: (row.visibility as FormState["visibility"]) || "public",
    status: "pending_review",
    evidence_level: row.evidence_level as EvidenceLevel,
    evidence_grade: row.evidence_grade || "",
    evidence_summary: row.evidence_summary || "",
    sources: sourcesToText(row.sources),
  };
}

export default function KnowledgeAdmin() {
  const [articles, setArticles] = useState<KnowledgeArticleRow[]>([]);
  const [submissions, setSubmissions] = useState<KnowledgeSubmissionRow[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [reviewNotes, setReviewNotes] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"contribute" | "audit">("contribute");

  const selectedArticle = useMemo(() => articles.find((article) => article.id === form.id), [articles, form.id]);
  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === selectedSubmissionId),
    [submissions, selectedSubmissionId]
  );

  const pendingSubmissions = submissions.filter((submission) => ["submitted", "auto_verified", "needs_revision"].includes(submission.status));

  const refresh = async () => {
    setLoading(true);
    try {
      const [articleData, submissionData] = await Promise.all([
        fetchAllKnowledgeArticlesForAdmin(),
        fetchKnowledgeSubmissions(),
      ]);
      setArticles(articleData);
      setSubmissions(submissionData);
    } catch (error: any) {
      toast.error(error.message || "Não foi possível carregar a governança da biblioteca");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const handleTitleChange = (title: string) => {
    setForm((current) => ({
      ...current,
      title,
      slug: current.id ? current.slug : normalizeSlug(title),
    }));
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setSelectedSubmissionId(null);
    setReviewNotes("");
    setMode("contribute");
  };

  const submitContribution = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Título e conteúdo são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      await submitKnowledgeContribution({
        target_article_id: form.target_article_id || null,
        submission_type: form.submission_type,
        title: form.title,
        slug: form.slug || normalizeSlug(form.title),
        category: form.category,
        summary: form.summary,
        content: form.content,
        tags: parseTags(form.tags),
        source_url: form.source_url,
        visibility: form.visibility,
        evidence_level: form.evidence_level,
        evidence_grade: form.evidence_grade,
        evidence_summary: form.evidence_summary,
        sources: parseSources(form.sources),
        status: "submitted",
      });
      toast.success("Contribuição submetida para curadoria");
      reset();
      await refresh();
    } catch (error: any) {
      toast.error(error.message || "Falha ao submeter contribuição. Verifique se o usuário está autenticado e verificado.");
    } finally {
      setSaving(false);
    }
  };

  const saveCanonicalDraft = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Título e conteúdo são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertKnowledgeArticle({
        id: form.id,
        title: form.title,
        slug: form.slug || normalizeSlug(form.title),
        category: form.category,
        summary: form.summary,
        content: form.content,
        tags: parseTags(form.tags),
        source_url: form.source_url,
        visibility: form.visibility,
        status: form.status,
        evidence_level: form.evidence_level,
        evidence_grade: form.evidence_grade,
        evidence_summary: form.evidence_summary,
        sources: parseSources(form.sources),
      });
      toast.success("Registro canônico salvo");
      setForm(articleToForm(saved));
      await refresh();
    } catch (error: any) {
      toast.error(error.message || "Falha ao salvar registro canônico");
    } finally {
      setSaving(false);
    }
  };

  const decideSubmission = async (decision: "approved" | "needs_revision" | "rejected" | "archived") => {
    if (!selectedSubmissionId) return;
    setSaving(true);
    try {
      await reviewKnowledgeSubmission(selectedSubmissionId, decision, reviewNotes);
      toast.success(
        decision === "approved"
          ? "Contribuição aprovada e publicada/atualizada"
          : "Decisão de curadoria registrada"
      );
      setSelectedSubmissionId(null);
      setReviewNotes("");
      await refresh();
    } catch (error: any) {
      toast.error(error.message || "Falha ao revisar submissão");
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!form.id) return;
    setSaving(true);
    try {
      await archiveKnowledgeArticle(form.id, reviewNotes || "Arquivamento por auditoria master");
      toast.success("Conteúdo arquivado pelo auditor master");
      reset();
      await refresh();
    } catch (error: any) {
      toast.error(error.message || "Falha ao arquivar conteúdo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="container py-4 flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/biblioteca" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Biblioteca pública
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Governança verificável
            </Badge>
            <Button size="sm" variant="outline" onClick={reset} className="gap-2">
              <Plus className="h-4 w-4" /> Nova contribuição
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <section className="panel grid gap-4 md:grid-cols-[1.2fr_.8fr] items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Biblioteca como comunidade científica curada</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Colaboradores verificados podem submeter novos conteúdos, expansões e correções. O auditor master não bloqueia a construção do conhecimento: ele preserva rastreabilidade, evidência e qualidade editorial antes da publicação canônica.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-border/60 p-3 bg-secondary/30">
              <p className="text-2xl font-semibold">{articles.length}</p>
              <p className="text-[11px] text-muted-foreground">artigos</p>
            </div>
            <div className="rounded-xl border border-border/60 p-3 bg-secondary/30">
              <p className="text-2xl font-semibold">{pendingSubmissions.length}</p>
              <p className="text-[11px] text-muted-foreground">pendentes</p>
            </div>
            <div className="rounded-xl border border-border/60 p-3 bg-secondary/30">
              <p className="text-2xl font-semibold">{submissions.length}</p>
              <p className="text-[11px] text-muted-foreground">submissões</p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button variant={mode === "contribute" ? "default" : "outline"} onClick={() => setMode("contribute")}>
            Submeter / expandir
          </Button>
          <Button variant={mode === "audit" ? "default" : "outline"} onClick={() => setMode("audit")}>
            Curadoria e auditoria
          </Button>
        </div>

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="panel h-fit space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Fila de conhecimento</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Submissões verificáveis e artigos canônicos.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : mode === "audit" ? (
              <div className="space-y-5 max-h-[75vh] overflow-auto pr-1">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Submissões para curadoria</p>
                  {submissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma submissão.</p>
                  ) : submissions.map((submission) => (
                    <button
                      key={submission.id}
                      type="button"
                      onClick={() => {
                        setSelectedSubmissionId(submission.id);
                        setForm(submissionToForm(submission));
                        setReviewNotes(submission.reviewer_notes || "");
                      }}
                      className={`w-full text-left rounded-xl border p-3 transition hover:border-primary/40 ${submission.id === selectedSubmissionId ? "border-primary/60 bg-primary/10" : "border-border/60 bg-secondary/30"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-snug">{submission.title}</p>
                        <Badge variant={submission.status === "approved" ? "default" : "secondary"} className="text-[10px]">
                          {submission.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{submission.summary}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">{submission.submission_type} · {submission.evidence_level}</p>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Artigos canônicos</p>
                  {articles.map((article) => (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => {
                        setSelectedSubmissionId(null);
                        setForm(articleToForm(article));
                        setReviewNotes(article.reviewer_notes || "");
                      }}
                      className={`w-full text-left rounded-xl border p-3 transition hover:border-primary/40 ${article.id === form.id ? "border-primary/60 bg-primary/10" : "border-border/60 bg-secondary/30"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-snug">{article.title}</p>
                        <Badge variant={article.status === "published" ? "default" : "secondary"} className="text-[10px]">
                          {article.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">/{article.slug}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[75vh] overflow-auto pr-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Escolha um artigo para expandir ou comece um novo</p>
                {articles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => {
                      setForm({ ...articleToForm(article), id: undefined, target_article_id: article.id, submission_type: "expansion", status: "pending_review" });
                    }}
                    className="w-full text-left rounded-xl border border-border/60 bg-secondary/30 p-3 transition hover:border-primary/40"
                  >
                    <p className="font-medium text-sm leading-snug">{article.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">Expandir / corrigir · {article.status}</p>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="panel space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {mode === "audit" ? "Curadoria técnica" : form.target_article_id ? "Expandir artigo existente" : "Nova contribuição verificável"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedSubmission
                    ? `Submetido em ${new Date(selectedSubmission.created_at).toLocaleString("pt-BR")}`
                    : selectedArticle
                      ? `Canônico atualizado em ${new Date(selectedArticle.updated_at).toLocaleString("pt-BR")}`
                      : "A publicação depende de verificação, fonte robusta ou revisão por auditor."}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                {mode === "audit" && selectedSubmissionId && (
                  <>
                    <Button type="button" size="sm" variant="outline" onClick={() => decideSubmission("needs_revision")} disabled={saving} className="gap-2">
                      <Edit3 className="h-4 w-4" /> Revisar
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => decideSubmission("rejected")} disabled={saving} className="gap-2">
                      <XCircle className="h-4 w-4" /> Rejeitar
                    </Button>
                    <Button type="button" size="sm" onClick={() => decideSubmission("approved")} disabled={saving} className="gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Aprovar/publicar
                    </Button>
                  </>
                )}
                {mode === "audit" && form.id && (
                  <>
                    <Button type="button" variant="destructive" size="sm" onClick={archive} disabled={saving} className="gap-2">
                      <Trash2 className="h-4 w-4" /> Arquivar
                    </Button>
                    <Button type="button" size="sm" onClick={saveCanonicalDraft} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar canônico
                    </Button>
                  </>
                )}
                {mode === "contribute" && (
                  <Button type="button" size="sm" onClick={submitContribution} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Submeter para curadoria
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input value={form.title} onChange={(event) => handleTitleChange(event.target.value)} placeholder="Título do conteúdo" />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(event) => update({ slug: normalizeSlug(event.target.value) })} placeholder="slug-publico" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <select value={form.submission_type} onChange={(event) => update({ submission_type: event.target.value as FormState["submission_type"] })} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="new_article">novo artigo</option>
                  <option value="expansion">expansão</option>
                  <option value="correction">correção</option>
                  <option value="revision">revisão</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input value={form.category} onChange={(event) => update({ category: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status canônico</Label>
                <select value={form.status} onChange={(event) => update({ status: event.target.value as FormState["status"] })} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="draft">draft</option>
                  <option value="pending_review">pending_review</option>
                  <option value="needs_revision">needs_revision</option>
                  <option value="published">published</option>
                  <option value="rejected">rejected</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Visibilidade</Label>
                <select value={form.visibility} onChange={(event) => update({ visibility: event.target.value as FormState["visibility"] })} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="public">public</option>
                  <option value="authenticated">authenticated</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Resumo</Label>
              <Textarea rows={3} value={form.summary} onChange={(event) => update({ summary: event.target.value })} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tags separadas por vírgula</Label>
                <Input value={form.tags} onChange={(event) => update({ tags: event.target.value })} placeholder="uhs, protocolo-vida, rag" />
              </div>
              <div className="space-y-1.5">
                <Label>Fonte/URL principal opcional</Label>
                <Input value={form.source_url} onChange={(event) => update({ source_url: event.target.value })} placeholder="https://..." />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Nível de evidência</Label>
                <select value={form.evidence_level} onChange={(event) => update({ evidence_level: event.target.value as EvidenceLevel })} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {(Object.keys(evidenceLevelLabels) as EvidenceLevel[]).map((level) => (
                    <option key={level} value={level}>{evidenceLevelLabels[level]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Grau/chancela</Label>
                <Input value={form.evidence_grade} onChange={(event) => update({ evidence_grade: event.target.value })} placeholder="Ex.: GRADE alto, EULAR, ACR, ANVISA..." />
              </div>
              <div className="space-y-1.5">
                <Label>Fontes estruturadas</Label>
                <Textarea rows={1} value={form.sources} onChange={(event) => update({ sources: event.target.value })} placeholder="Título | URL | Publicador | Ano" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Resumo da evidência e limites</Label>
              <Textarea rows={3} value={form.evidence_summary} onChange={(event) => update({ evidence_summary: event.target.value })} placeholder="Explique por que a fonte sustenta a contribuição, quais são os limites e quando não aplicar." />
            </div>

            {mode === "audit" && (
              <div className="space-y-1.5">
                <Label>Notas do auditor master / curadoria</Label>
                <Textarea rows={3} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Justificativa da aprovação, pedido de revisão, rejeição ou arquivamento." />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-primary" />
                <Label>Conteúdo em Markdown</Label>
              </div>
              <Textarea rows={18} value={form.content} onChange={(event) => update({ content: event.target.value })} className="font-mono text-sm" />
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
