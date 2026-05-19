import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Edit3, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  KnowledgeArticleRow,
  archiveKnowledgeArticle,
  fetchAllKnowledgeArticlesForAdmin,
  normalizeSlug,
  parseTags,
  upsertKnowledgeArticle,
} from "@/lib/knowledgeSupabase";

type FormState = {
  id?: string;
  title: string;
  slug: string;
  category: string;
  summary: string;
  content: string;
  tags: string;
  source_url: string;
  visibility: "public" | "authenticated" | "admin";
  status: "draft" | "published" | "archived";
};

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  category: "UHS Health OS",
  summary: "",
  content: "# Novo conteúdo\n\nEscreva aqui em Markdown.",
  tags: "uhs, protocolo-vida",
  source_url: "",
  visibility: "public",
  status: "draft",
};

function rowToForm(row: KnowledgeArticleRow): FormState {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    summary: row.summary || "",
    content: row.content,
    tags: (row.tags || []).join(", "),
    source_url: row.source_url || "",
    visibility: (row.visibility as FormState["visibility"]) || "public",
    status: (row.status as FormState["status"]) || "draft",
  };
}

export default function KnowledgeAdmin() {
  const [articles, setArticles] = useState<KnowledgeArticleRow[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedArticle = useMemo(() => articles.find((article) => article.id === form.id), [articles, form.id]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await fetchAllKnowledgeArticlesForAdmin();
      setArticles(data);
    } catch (error: any) {
      toast.error(error.message || "Não foi possível carregar a biblioteca administrativa");
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

  const save = async () => {
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
      });
      toast.success("Conteúdo salvo");
      setForm(rowToForm(saved));
      await refresh();
    } catch (error: any) {
      toast.error(error.message || "Falha ao salvar conteúdo");
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!form.id) return;
    setSaving(true);
    try {
      await archiveKnowledgeArticle(form.id);
      toast.success("Conteúdo arquivado");
      setForm(EMPTY_FORM);
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
            <Badge variant="outline" className="border-primary/40 text-primary">Admin · Supabase</Badge>
            <Button size="sm" variant="outline" onClick={() => setForm(EMPTY_FORM)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="panel h-fit space-y-4">
          <div>
            <h1 className="text-lg font-semibold">Conteúdos</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Lista administrativa da tabela knowledge_articles.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum conteúdo no Supabase ainda.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {articles.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => setForm(rowToForm(article))}
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
          )}
        </aside>

        <section className="panel space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-xl font-semibold">{form.id ? "Editar conteúdo" : "Novo conteúdo"}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedArticle ? `Última atualização: ${new Date(selectedArticle.updated_at).toLocaleString("pt-BR")}` : "Crie artigos em Markdown para a biblioteca viva."}
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              {form.id && (
                <Button type="button" variant="destructive" size="sm" onClick={archive} disabled={saving} className="gap-2">
                  <Trash2 className="h-4 w-4" /> Arquivar
                </Button>
              )}
              <Button type="button" size="sm" onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
              </Button>
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(event) => update({ category: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={(event) => update({ status: event.target.value as FormState["status"] })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Visibilidade</Label>
              <select
                value={form.visibility}
                onChange={(event) => update({ visibility: event.target.value as FormState["visibility"] })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
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
              <Label>Fonte/URL opcional</Label>
              <Input value={form.source_url} onChange={(event) => update({ source_url: event.target.value })} placeholder="https://..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-primary" />
              <Label>Conteúdo em Markdown</Label>
            </div>
            <Textarea rows={18} value={form.content} onChange={(event) => update({ content: event.target.value })} className="font-mono text-sm" />
          </div>
        </section>
      </main>
    </div>
  );
}
