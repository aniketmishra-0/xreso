import styles from "./page.module.css";
import { getMcqTopicCards } from "@/lib/excel";

export const revalidate = 30;

export default async function McqPage() {
  const topicCards = await getMcqTopicCards(12);
  const cardsToShow = topicCards.map((topic) => ({
    title: topic.topic,
    questionCount: topic.questionCount,
    difficultyMix: topic.difficultyMix || "Mixed",
    updatedAt: topic.lastUpdated,
  }));
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
                  : "Add your first MCQ from Upload page to initialize the live topic board"}
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
            <p className={styles.heroAsideTitle}>Submission Flow</p>
            <p className={styles.heroAsideText}>
              Open Upload page and choose Contribute MCQ mode to submit new questions.
            </p>
            <p className={styles.heroAsideText}>
              Every successful MCQ submission updates this topic board automatically.
            </p>
          </aside>
        </div>

        <div className={styles.contentGrid}>
          <section className={`${styles.topicPanel} ${styles.topicPanelStandalone}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>MCQ Topic Board</h2>
              <p className={styles.sectionText}>
                This board is data-driven from your MCQ workbook and updates when new entries are
                saved.
              </p>
            </div>

            {hasTopics ? (
              <div className={styles.grid}>
                {cardsToShow.map((topic, index) => (
                  <article key={`${topic.title}-${index}`} className={styles.card}>
                    <div className={styles.cardTop}>
                      <h3 className={styles.cardTitle}>{topic.title}</h3>
                      <p className={styles.cardCount}>{topic.questionCount}</p>
                    </div>
                    <p className={styles.cardCountLabel}>Questions</p>
                    <div className={styles.cardMetaRow}>
                      <p className={styles.cardMix}>{topic.difficultyMix}</p>
                      <p className={styles.cardUpdated}>Updated {topic.updatedAt}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <h3 className={styles.emptyTitle}>No MCQ topics yet</h3>
                <p className={styles.emptyText}>
                  Submit your first MCQ from Upload page in Contribute MCQ mode. A new topic card
                  will appear here automatically.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
