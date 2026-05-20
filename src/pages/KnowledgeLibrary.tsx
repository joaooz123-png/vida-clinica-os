import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Clock, FileText, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KnowledgeArticle, knowledgeArticles } from "@/lib/knowledgeBase";
import { fetchPublishedKnowledgeArticles, mergeRemoteWithStatic } from "@/lib/knowledgeSupabase";

function filterArticles(articles: KnowledgeArticle[], query: string, category: string) {
  const normalized = query.trim().toLowerCase();
  return articles.filter((article) => {
    const matchesCategory = category === "Todos" || article.category === category;
    const haystack = [article.title, article.summary, article.category, article.tags.join(" "), article.content]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !normalized || haystack.includes(normalized);
    return matchesCategory && matchesQuery;
  });
}

export default function KnowledgeLibrary() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [source, setSource] = useState<"supabase" | "fallback" | "loading">("loading");
  const [allArticles, setAllArticles] = useState<KnowledgeArticle[]>(knowledgeArticles);

  useEffect(() => {
    let mounted = true;
    fetchPublishedKnowledgeArticles()
      .then((remote) => {
        if (!mounted) return;
        const merged = mergeRemoteWithStatic(remote);
        setAllArticles(merged.length ? merged : knowledgeArticles);
        setSource(remote.length ? "supabase" : "fallback");
      })
      .catch(() => {
        if (!mounted) return;
        setAllArticles(knowledgeArticles);
        setSource("fallback");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(allArticles.map((article) => article.category)))],
    [allArticles]
  );

  const articles = useMemo(() => filterArticles(allArticles, query, category), [allArticles, query, category]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="container py-4 flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar ao OS
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/biblioteca">Admin</Link>
            </Button>
            <Badge variant="outline" className="border-primary/40 text-primary">
              {source === "loading" ? "Carregando" : source === "supabase" ? "Supabase ativo" : "Fallback local"}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        <section className="panel overflow-hidden relative">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: "var(--gradient-cyan)" }} />
          <div className="relative grid gap-4 md:grid-cols-[1.4fr_.8fr] items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Protocolo Vida Knowledge Layer
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                  Biblioteca de Conhecimento
                </h1>
                <p className="mt-3 max-w-2xl text-sm md:text-base text-muted-foreground leading-relaxed">
                  Núcleo versionado para organizar protocolos, raciocínio clínico, documentação estratégica,
                  educação em saúde e futuras camadas de IA/RAG do UHS Health OS.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-cyan)" }}>
                  <BookOpen className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{articles.length}</p>
                  <p className="text-xs text-muted-foreground">conteúdos encontrados</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-[1fr_auto] items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por tema, protocolo, tag ou palavra-chave..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`chip ${category === item ? "chip-active" : ""}`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.id}
              to={`/biblioteca/${article.slug}`}
              className="panel group block transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-glow)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <Badge variant="secondary">{article.category}</Badge>
              </div>
              <h2 className="mt-4 text-lg font-semibold group-hover:text-primary transition">
                {article.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {article.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {article.tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[11px]">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Atualizado em {new Date(article.updatedAt).toLocaleDateString("pt-BR")}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {article.readingMinutes} min
                </span>
              </div>
            </Link>
          ))}
        </section>

        {articles.length === 0 && (
          <div className="panel text-center py-10">
            <p className="font-medium">Nenhum conteúdo encontrado.</p>
            <p className="text-sm text-muted-foreground mt-1">Tente outro termo ou categoria.</p>
          </div>
        )}
      </main>
    </div>
  );
}
