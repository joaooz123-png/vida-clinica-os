export type KnowledgeArticle = {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string;
  tags: string[];
  updatedAt: string;
  readingMinutes: number;
  content: string;
};

export const knowledgeArticles: KnowledgeArticle[] = [
  {
    id: "uhs-health-os",
    title: "UHS Health OS: camada operacional clínica",
    slug: "uhs-health-os",
    category: "Estratégia",
    summary:
      "Visão geral do UHS Health OS como uma camada clínica para coordenação longitudinal, confiança, desfechos e gestão populacional.",
    tags: ["UHS", "Protocolo Vida", "Health OS", "estratégia"],
    updatedAt: "2026-05-18",
    readingMinutes: 5,
    content: `# UHS Health OS\n\nO UHS Health OS é concebido como uma camada operacional clínica para organizar jornadas de cuidado, registros longitudinais, eventos relevantes e decisões assistenciais.\n\n## Princípios\n\n- cuidado longitudinal;\n- interoperabilidade futura;\n- segurança e privacidade desde a origem;\n- registro de eventos clínicos relevantes;\n- separação entre dado sensível e camada de auditoria.\n\n## Direção técnica\n\nA arquitetura desejada pode evoluir para um modelo híbrido: dados clínicos sensíveis protegidos em banco tradicional, com trilhas de consentimento, integridade e auditoria em camada verificável.\n\n## Próximos passos\n\nA biblioteca deve crescer com protocolos, glossário, documentação técnica, evidências e materiais educativos.`
  },
  {
    id: "fibromialgia",
    title: "Fibromialgia: avaliação clínica estruturada",
    slug: "fibromialgia",
    category: "Reumatologia",
    summary:
      "Resumo prático para organização de sintomas, dor difusa, impacto funcional e educação do paciente em fibromialgia.",
    tags: ["fibromialgia", "dor crônica", "WPI", "SSS", "FIQR"],
    updatedAt: "2026-05-18",
    readingMinutes: 4,
    content: `# Fibromialgia\n\nA fibromialgia é uma síndrome de dor crônica caracterizada por dor difusa, fadiga, sono não reparador, sintomas cognitivos e impacto funcional variável.\n\n## Avaliação estruturada\n\nUma biblioteca clínica pode registrar:\n\n- localização e padrão da dor;\n- intensidade pela EVA;\n- sintomas associados;\n- impacto funcional;\n- escalas como WPI, SSS e FIQR;\n- fatores de piora e melhora;\n- plano terapêutico longitudinal.\n\n## Uso no sistema\n\nO conteúdo deve servir para educação, padronização de consultas e geração de materiais de acompanhamento.`
  },
  {
    id: "osteoporose-sarcopenia",
    title: "Osteoporose, sarcopenia e risco músculo-esquelético",
    slug: "osteoporose-sarcopenia",
    category: "Aparelho locomotor",
    summary:
      "Base introdutória para integrar osso, músculo, tendão, risco de queda, fragilidade e perda ponderal em um cuidado único.",
    tags: ["osteoporose", "sarcopenia", "tendinopatia", "quedas"],
    updatedAt: "2026-05-18",
    readingMinutes: 4,
    content: `# Osteoporose e sarcopenia\n\nO cuidado músculo-esquelético deve integrar osso, músculo, tendão, equilíbrio e risco de queda.\n\n## Eixos de observação\n\n- histórico de fratura;\n- perda de força;\n- perda de massa muscular;\n- quedas;\n- dor persistente;\n- medicamentos e comorbidades;\n- perda ponderal rápida.\n\n## Aplicação na biblioteca\n\nEste tema pode alimentar protocolos educativos, checklists de consulta, roteiros de reels e formulários de triagem.`
  }
];

export function findArticleBySlug(slug: string) {
  return knowledgeArticles.find((article) => article.slug === slug);
}

export function searchKnowledge(query: string, category: string) {
  const normalized = query.trim().toLowerCase();
  return knowledgeArticles.filter((article) => {
    const matchesCategory = category === "Todos" || article.category === category;
    const haystack = [article.title, article.summary, article.category, article.tags.join(" "), article.content]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !normalized || haystack.includes(normalized);
    return matchesCategory && matchesQuery;
  });
}

export const knowledgeCategories = ["Todos", ...Array.from(new Set(knowledgeArticles.map((article) => article.category)))];
