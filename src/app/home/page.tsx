import Link from "next/link";
import ContributeCtaLink from "@/components/ContributeCtaLink";
import styles from "./page.module.css";

type HubTone = "library" | "video" | "mcq" | "contribute" | "category" | "advanced";

type HubItem = {
	title: string;
	description: string;
	href: string;
	cta: string;
	group: string;
	metric: string;
	tone: HubTone;
};

const HUB_ITEMS: HubItem[] = [
	{
		title: "Library",
		description: "Browse handwritten notes by topic, language, and community tags.",
		href: "/browse",
		cta: "Open Library",
		group: "Foundation",
		metric: "1.2k+ notes",
		tone: "library",
	},
	{
		title: "Videos",
		description: "Watch curated programming videos with language and topic filters.",
		href: "/videos",
		cta: "Watch Videos",
		group: "Visual Track",
		metric: "Daily picks",
		tone: "video",
	},
	{
		title: "MCQ",
		description: "Practice quick multiple-choice quizzes and sharpen core concepts.",
		href: "/mcq",
		cta: "Start MCQ",
		group: "Practice",
		metric: "Fast rounds",
		tone: "mcq",
	},
	{
		title: "Contribute",
		description: "Share your notes, links, and video resources with the community.",
		href: "/upload?mode=programming&focus=contribute",
		cta: "Contribute",
		group: "Community",
		metric: "Open submissions",
		tone: "contribute",
	},
	{
		title: "Categories",
		description: "Jump directly to focused tracks like Python, SQL, DSA, and more.",
		href: "/categories",
		cta: "View Categories",
		group: "Discovery",
		metric: "20+ domains",
		tone: "category",
	},
	{
		title: "Advanced",
		description: "Explore cloud and system design resources in advanced tracks.",
		href: "/tracks",
		cta: "Open Advanced",
		group: "Deep Tech",
		metric: "Cloud + system",
		tone: "advanced",
	},
];

const HUB_STATS = [
	{ label: "Entry Nodes", value: "6" },
	{ label: "Learning Modes", value: "3" },
	{ label: "Flow", value: "Discover → Build" },
];

const FLOW_STEPS = ["Browse", "Watch", "Practice", "Contribute"];
const HERO_VISUAL_BADGES = ["Curated Paths", "Community Driven", "Fast Practice"];

const HERO_PREVIEW_ITEMS = HUB_ITEMS.slice(0, 4);

const TONE_CLASS_MAP: Record<HubTone, string> = {
	library: styles.toneLibrary,
	video: styles.toneVideo,
	mcq: styles.toneMcq,
	contribute: styles.toneContribute,
	category: styles.toneCategory,
	advanced: styles.toneAdvanced,
};

export default function HomeHubPage() {
	return (
		<section className={styles.page}>
			<div className={styles.hero}>
				<div className={styles.heroBackdrop} aria-hidden="true" />
				<div className={styles.heroVisualLayer} aria-hidden="true">
					<span className={`${styles.visualOrb} ${styles.visualOrbPrimary}`} />
					<span className={`${styles.visualOrb} ${styles.visualOrbAccent}`} />
					<span className={styles.visualBeam} />
				</div>

				<div className={styles.heroContent}>
					<p className={styles.eyebrow}>HOME HUB</p>
					<h1 className={styles.title}>
						Welcome to <span className={styles.titleAccent}>xreso</span>
					</h1>
					<p className={styles.heroLead}>Structured to help you discover and build.</p>
					<p className={styles.subtitle}>
						Your central graph for library discovery, curated learning, MCQ practice, and open
						contributions.
					</p>
					<div className={styles.heroBadgeRow}>
						{HERO_VISUAL_BADGES.map((badge) => (
							<span key={badge} className={styles.heroBadge}>
								{badge}
							</span>
						))}
					</div>
				</div>

				<div className={styles.heroCapabilityWrap}>
					<div className={styles.heroCapabilityTop}>
						<div className={styles.heroCapabilityHead}>
							<span className={styles.heroCapabilityLabel}>Capabilities</span>
							<span className={styles.heroCapabilityLine} />
						</div>

						<div className={styles.heroFlowRow} aria-label="Suggested learning flow">
							{FLOW_STEPS.map((step) => (
								<span key={step} className={styles.heroFlowPill}>
									{step}
								</span>
							))}
						</div>

						<div className={styles.heroMiniGraph} aria-hidden="true">
							<span className={styles.heroMiniBar} />
							<span className={styles.heroMiniBar} />
							<span className={styles.heroMiniBar} />
							<span className={styles.heroMiniBar} />
						</div>
					</div>

					<div className={styles.heroLaneRow} aria-label="Primary home hub nodes">
						{HERO_PREVIEW_ITEMS.map((item) => (
							item.cta === "Contribute" ? (
								<ContributeCtaLink
									key={item.title}
									href={item.href}
									className={`${styles.heroLanePill} ${TONE_CLASS_MAP[item.tone]}`}
									source="home-hub-hero-pill"
								>
									{item.title}
								</ContributeCtaLink>
							) : (
								<Link
									key={item.title}
									href={item.href}
									className={`${styles.heroLanePill} ${TONE_CLASS_MAP[item.tone]}`}
								>
									{item.title}
								</Link>
							)
						))}
					</div>

					<div className={styles.heroStats}>
						{HUB_STATS.map((stat) => (
							<div key={stat.label} className={styles.statCard}>
								<p className={styles.statValue}>{stat.value}</p>
								<p className={styles.statLabel}>{stat.label}</p>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className={styles.graphSection}>
				<div className={styles.graphBackdrop} aria-hidden="true" />

				<div className={styles.graphHeader}>
					<h2 className={styles.graphTitle}>Learning Graph</h2>
					<p className={styles.graphSubtitle}>
						Pick any node to start. Every path remains connected to your next learning action.
					</p>
				</div>

				<div className={styles.grid}>
					{HUB_ITEMS.map((item) => (
						<article key={item.title} className={`${styles.card} ${TONE_CLASS_MAP[item.tone]}`}>
							<div className={styles.cardMeta}>
								<span className={styles.cardGroup}>{item.group}</span>
								<span className={styles.cardMetric}>{item.metric}</span>
							</div>
							<h3 className={styles.cardTitle}>{item.title}</h3>
							<p className={styles.cardDescription}>{item.description}</p>
							{item.cta === "Contribute" ? (
								<ContributeCtaLink href={item.href} className={styles.cardCta} source="home-hub-card">
									{item.cta}
								</ContributeCtaLink>
							) : (
								<Link href={item.href} className={styles.cardCta}>
									{item.cta}
								</Link>
							)}
						</article>
					))}
				</div>

				<div className={styles.flowRow} aria-label="Suggested learning flow">
					{FLOW_STEPS.map((step) => (
						<span key={step} className={styles.flowPill}>
							{step}
						</span>
					))}
				</div>
			</div>
		</section>
	);
}
