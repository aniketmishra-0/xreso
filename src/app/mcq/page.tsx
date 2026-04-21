import styles from "./page.module.css";
import { getMcqTopicCards } from "@/lib/excel";
import McqContributeForm from "./McqContributeForm";
import { auth } from "@/lib/auth";

export const revalidate = 30;

export default async function McqPage() {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user?.id);
  const topicCards = await getMcqTopicCards(12);
  const cardsToShow = topicCards.map((topic) => ({
    title: topic.topic,
    questionCount: topic.questionCount,
    difficultyMix: topic.difficultyMix || "Mixed",
    updatedAt: topic.lastUpdated,
  }));
  const topicSuggestions = topicCards.map((topic) => topic.topic);
  const totalQuestions = topicCards.reduce((sum, topic) => sum + topic.questionCount, 0);
  const latestSync = topicCards[0]?.lastUpdated || "No entries yet";
  const hasTopics = cardsToShow.length > 0;

  return (
    <section className={styles.page}>
      <div className={styles.bgGlowOne} aria-hidden="true" />
      <div className={styles.bgGlowTwo} aria-hidden="true" />

      <div className={styles.shell}>
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.eyebrow}>MCQ PRACTICE ARENA</p>
            <h1 className={styles.title}>
              Build, organize and launch <span className={styles.titleAccent}>topic-wise MCQs</span>
            </h1>
            <p className={styles.subtitle}>
              This page is now dynamic. As soon as a question is contributed, its topic and counts
              are reflected below with no manual update needed.
            </p>

            <div className={styles.statusRow}>
              <span className={styles.statusPill}>{hasTopics ? "Live Data" : "Ready to Start"}</span>
              <span className={styles.statusHint}>
                {hasTopics
                  ? "MCQ topic cards are being generated from your workbook in real-time refresh cycles"
                  : "Contribute your first MCQ to initialize the live topic board"}
              </span>
            </div>

            <div className={styles.metricGrid}>
              <article className={styles.metricCard}>
                <p className={styles.metricLabel}>Topics</p>
                <p className={styles.metricValue}>{topicCards.length}</p>
              </article>
              <article className={styles.metricCard}>
                <p className={styles.metricLabel}>Questions</p>
                <p className={styles.metricValue}>{totalQuestions}</p>
              </article>
              <article className={styles.metricCard}>
                <p className={styles.metricLabel}>Last Sync</p>
                <p className={styles.metricValueSmall}>{latestSync}</p>
              </article>
            </div>
          </div>

          <aside className={styles.heroAside}>
            <p className={styles.heroAsideTitle}>Contribute Flow</p>
            <p className={styles.heroAsideText}>
              Add one question and the topic is created automatically, then appears in the topic
              board.
            </p>
            <p className={styles.heroAsideText}>
              You can choose an existing topic or type a new topic to expand your MCQ library.
            </p>
          </aside>
        </div>

        <div className={styles.contentGrid}>
          <section className={styles.contributePanel}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Contribute Questions</h2>
              <p className={styles.sectionText}>
                Add validated MCQs directly into quiz bank with topic and difficulty mapping.
              </p>
            </div>
            <McqContributeForm
              topicSuggestions={topicSuggestions}
              isAuthenticated={isAuthenticated}
            />
          </section>

          <section className={styles.topicPanel}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Topic Board</h2>
              <p className={styles.sectionText}>
                This board is data-driven from your MCQ workbook and updates when new entries are
                saved.
              </p>
            </div>

            {hasTopics ? (
              <div className={styles.grid}>
                {cardsToShow.map((topic, index) => (
                  <article key={`${topic.title}-${index}`} className={styles.card}>
                    <p className={styles.cardLabel}>Updated {topic.updatedAt}</p>
                    <h3 className={styles.cardTitle}>{topic.title}</h3>
                    <p className={styles.cardMeta}>{topic.questionCount} questions</p>
                    <p className={styles.cardMix}>{topic.difficultyMix}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <h3 className={styles.emptyTitle}>No MCQ topics yet</h3>
                <p className={styles.emptyText}>
                  Start with one question in contribute panel. A new topic card will appear here
                  automatically.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
