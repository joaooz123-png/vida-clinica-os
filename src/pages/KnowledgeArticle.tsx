import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Calendar, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import { findArticleBySlug, KnowledgeArticle as KnowledgeArticleType } from "@/lib/knowledgeBase";
import { fetchKnowledgeArticleBySlug } from "@/lib/knowledgeSupabase";

export default function KnowledgeArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState<KnowledgeArticleType | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    const local = slug ? findArticleBySlug(slug) : null;
    setArticle(undefined);

    if (!slug) {
      setArticle(null);
      return;
    }

    fetchKnowledgeArticleBySlug(slug)
      .then((remote) => {
        if (!mounted) return;
        setArticle(remote || local || null);
      })
      .catch(() => {
        if (!mounted) return;
        setArticle(local || null);
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  if (article === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="panel max-w-lg text-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando conteúdo da biblioteca...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="panel max-w-lg text-center space-y-4">
          <BookOpen className="h-10 w-10 text-primary mx-auto" />
          <div>
            <h1 className="text-xl font-semibold">Conteúdo não encontrado</h1>
            <p className="text-sm text-muted-foreground mt-2">
              O artigo solicitado não existe ou ainda não foi publicado na biblioteca.
            </p>
          </div>
          <Button asChild>
            <Link to="/biblioteca">Voltar para a biblioteca</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="container py-4 flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/biblioteca" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Biblioteca
            </Link>
          </Button>
          <div className="ml-auto">
            <Badge variant="outline" className="border-primary/40 text-primary">
              {article.category}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-4xl space-y-6">
        <section className="panel space-y-5">
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              {article.title}
            </h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              {article.summary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Atualizado em {new Date(article.updatedAt).toLocaleDateString("pt-BR")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {article.readingMinutes} minutos de leitura
            </span>
          </div>
        </section>

        <article className="panel prose prose-invert max-w-none prose-headings:tracking-tight prose-a:text-primary prose-strong:text-foreground">
          <Markdown>{article.content}</Markdown>
        </article>
      </main>
    </div>
  );
}
