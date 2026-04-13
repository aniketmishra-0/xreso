import Link from "next/link";
import styles from "./page.module.css";

const TEAM_MEMBERS = [
  {
    name: "Aniket Mishra",
    role: "Founder & Lead Developer",
    avatar: "A",
    bio: "Full-stack developer passionate about making education accessible.",
  },
];

const VALUES = [
  {
    icon: "🎓",
    title: "Education First",
    description:
      "We believe handwritten notes capture nuance that typed text cannot. Our mission is to make quality learning resources freely accessible.",
  },
  {
    icon: "🤝",
    title: "Community Driven",
    description:
      "Every note on xreso comes from real learners. We empower contributors with full copyright control and proper attribution.",
  },
  {
    icon: "🔓",
    title: "Open & Transparent",
    description:
      "Our licensing model is built on Creative Commons. Authors choose how their work is shared, and credit always flows back.",
  },
  {
    icon: "⚡",
    title: "Developer Experience",
    description:
      "Fast search, clean UI, and zero clutter. We build for developers who value their time and want quick access to knowledge.",
  },
];

const MILESTONES = [
  { value: "500+", label: "Notes Shared" },
  { value: "2.5K+", label: "Active Learners" },
  { value: "50+", label: "Contributors" },
  { value: "9", label: "Categories" },
];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <span className={styles.heroBadge}>About xreso</span>
          <h1 className={styles.heroTitle}>
            Making handwritten notes
            <br />
            <span className={styles.heroAccent}>accessible to everyone</span>
          </h1>
          <p className={styles.heroSubtitle}>
            xreso is a community-driven platform where developers share their
            handwritten programming notes. We believe in the power of visual,
            hand-crafted learning resources.
          </p>
        </div>
      </section>

      {/* Milestones */}
      <section className={styles.milestones}>
        <div className={styles.container}>
          <div className={styles.milestoneGrid}>
            {MILESTONES.map((m) => (
              <div key={m.label} className={styles.milestoneCard}>
                <span className={styles.milestoneValue}>{m.value}</span>
                <span className={styles.milestoneLabel}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>What We Stand For</h2>
            <p className={styles.sectionSubtitle}>
              The principles that guide everything we build
            </p>
          </div>
          <div className={styles.valuesGrid}>
            {VALUES.map((v) => (
              <div key={v.title} className={styles.valueCard}>
                <span className={styles.valueIcon}>{v.icon}</span>
                <h3 className={styles.valueTitle}>{v.title}</h3>
                <p className={styles.valueDescription}>{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Meet the Team</h2>
            <p className={styles.sectionSubtitle}>
              The people behind xreso
            </p>
          </div>
          <div className={styles.teamGrid}>
            {TEAM_MEMBERS.map((member) => (
              <div key={member.name} className={styles.teamCard}>
                <div className={styles.teamAvatar}>{member.avatar}</div>
                <h3 className={styles.teamName}>{member.name}</h3>
                <span className={styles.teamRole}>{member.role}</span>
                <p className={styles.teamBio}>{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Ready to contribute?</h2>
            <p className={styles.ctaSubtitle}>
              Join our growing community of developers sharing knowledge.
            </p>
            <div className={styles.ctaActions}>
              <Link href="/upload" className="btn btn-primary btn-lg">
                Upload Notes
              </Link>
              <Link href="/browse" className="btn btn-secondary btn-lg">
                Browse Notes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
