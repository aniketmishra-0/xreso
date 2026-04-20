import Link from "next/link";
import ContributeCtaLink from "@/components/ContributeCtaLink";
import {
	getCategories,
	getLatestApprovedNotesActivity,
	getLibraryHeroStats,
	getTrendingTopicSignals,
	getTopContributors,
} from "@/lib/db/queries";
import HomeSidebarAccordion from "./HomeSidebarAccordion";
import styles from "./page.module.css";

export const revalidate = 30;

type GraphNode = {
	badge: string;
	badgeClass: string;
	meta: string;
	title: string;
	description: string;
	cta: string;
	href: string;
	contribute?: boolean;
};

type RankedTopic = {
	name: string;
	normalized: string;
	noteCount: number;
	signalScore: number;
	rankScore: number;
};

const NODES: GraphNode[] = [
	{
		badge: "Foundation",
		badgeClass: styles.badgeAmber,
		meta: "1.2k+ notes",
		title: "Library",
						description: "Browse handwritten notes by topic, language, and community tags.",
						cta: "Open Library →",
		href: "/browse",
	},
	{
		badge: "Visual Track",
		badgeClass: styles.badgePurple,
		meta: "Daily picks",
		title: "Videos",
						description: "Watch curated programming videos with language and topic filters.",
						cta: "Watch Videos →",
		href: "/videos",
	},
	{
		badge: "Practice",
		badgeClass: styles.badgeBlue,
		meta: "Fast rounds",
		title: "MCQ",
						description: "Practice quick multiple-choice quizzes and sharpen core concepts.",
						cta: "Start MCQ →",
		href: "/mcq",
	},
	{
		badge: "Community",
		badgeClass: styles.badgeGreen,
		meta: "Open submissions",
		title: "Contribute",
						description: "Share your notes, links, and video resources with the community.",
						cta: "Contribute →",
		href: "/upload?mode=programming&focus=contribute",
		contribute: true,
	},
	{
		badge: "Discovery",
		badgeClass: styles.badgePink,
		meta: "20+ domains",
		title: "Categories",
		description: "Jump to focused tracks — Python, SQL, DSA, React, and more.",
						cta: "View Categories →",
		href: "/categories",
	},
	{
		badge: "Deep Tech",
		badgeClass: styles.badgeOrange,
		meta: "Cloud + system",
		title: "Advanced",
						description: "Cloud native, system design, and advanced engineering tracks.",
						cta: "Open Advanced →",
		href: "/tracks",
	},
];

const FLOW_STEPS = ["Browse →", "Watch →", "Practice →", "Contribute"];

const AVATAR_COLORS = [styles.avatarOrange, styles.avatarGreen, styles.avatarBlue, styles.avatarPurple];

function normalizeTopicName(topic: string) {
	return topic.trim().replace(/^#/, "").replace(/\s+/g, " ").toLowerCase();
}

function mergeUniqueTopics(...topicGroups: string[][]) {
	const unique = new Map<string, string>();

	for (const group of topicGroups) {
		for (const topic of group) {
			const trimmed = topic.trim();
			if (!trimmed) continue;
			const normalized = normalizeTopicName(trimmed);
			if (!normalized || unique.has(normalized)) continue;
			unique.set(normalized, trimmed);
		}
	}

	return [...unique.values()];
}

function formatNoteLabel(count: number) {
	return `${count} note${count === 1 ? "" : "s"}`;
}

function formatCompact(value: number) {
	if (value < 1000) return String(value);
	return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatRelativeTime(dateString: string) {
	const then = new Date(dateString).getTime();
	if (Number.isNaN(then)) return "recently";
	const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
	if (diffSec < 60) return "just now";
	const minutes = Math.floor(diffSec / 60);
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} hr ago`;
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
}

function initials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
	if (parts.length === 0) return "XR";
	return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export default async function HomeHubPage() {
	const [categories, heroStats, latestActivity, topContributorRows, topicSignals] = await Promise.all([
		getCategories(10),
		getLibraryHeroStats(),
		getLatestApprovedNotesActivity(5),
		getTopContributors(5),
		getTrendingTopicSignals(20),
	]);

	const categoryTopicMap = new Map<string, { name: string; noteCount: number }>();
	for (const category of categories) {
		const normalized = normalizeTopicName(category.name);
		if (!normalized) continue;
		const existing = categoryTopicMap.get(normalized);
		if (!existing || category.noteCount > existing.noteCount) {
			categoryTopicMap.set(normalized, {
				name: category.name,
				noteCount: category.noteCount,
			});
		}
	}

	const signalTopicMap = new Map<string, { name: string; score: number }>();
	for (const signal of topicSignals) {
		const normalized = normalizeTopicName(signal.name);
		if (!normalized) continue;
		const existing = signalTopicMap.get(normalized);
		if (!existing || signal.score > existing.score) {
			signalTopicMap.set(normalized, { name: signal.name, score: signal.score });
		}
	}

	const candidateTopics = mergeUniqueTopics(
		[...categoryTopicMap.values()].map((entry) => entry.name),
		[...signalTopicMap.values()].map((entry) => entry.name),
	);

	const rankedTopics: RankedTopic[] = candidateTopics
		.map((topic) => {
			const normalized = normalizeTopicName(topic);
			const categoryInfo = categoryTopicMap.get(normalized);
			const signalInfo = signalTopicMap.get(normalized);
			const noteCount = categoryInfo?.noteCount ?? 0;
			const signalScore = signalInfo?.score ?? 0;

			return {
				name: signalInfo?.name || categoryInfo?.name || topic,
				normalized,
				noteCount,
				signalScore,
				rankScore: signalScore * 10 + noteCount * 4,
			};
		})
		.sort((a, b) => b.rankScore - a.rankScore || b.noteCount - a.noteCount || a.name.localeCompare(b.name));

	const tickerTopics =
		rankedTopics.length > 0
			? rankedTopics.slice(0, 14).map((topic) => topic.name)
			: NODES.map((node) => node.title);
	const doubledTopics = [...tickerTopics, ...tickerTopics];

	const trendingTopics = rankedTopics.slice(0, 6).map((topic, index) => ({
		rank: index + 1,
		name: topic.name,
		count:
			topic.noteCount > 0
				? formatNoteLabel(topic.noteCount)
				: `${Math.max(topic.signalScore, 1)} mention${Math.max(topic.signalScore, 1) === 1 ? "" : "s"}`,
		up: index < 3 || topic.signalScore >= 3,
	}));

	const liveActivity = latestActivity.slice(0, 5).map((note, index) => ({
		name: note.author || "Community member",
		title: note.title,
		time: formatRelativeTime(note.createdAt),
		initials: initials(note.author || "xreso"),
		color: AVATAR_COLORS[index % AVATAR_COLORS.length],
	}));

	const topContributors = topContributorRows.slice(0, 5).map((row, index) => ({
		name: row.name,
		noteText: `${row.noteCount} note${row.noteCount === 1 ? "" : "s"} shared`,
		initials: initials(row.name),
		color: AVATAR_COLORS[index % AVATAR_COLORS.length],
	}));

	const searchTags =
		rankedTopics.length > 0
			? rankedTopics.slice(0, 8).map((topic) => topic.name)
			: NODES.map((node) => node.title);

	const stats = [
		{ value: "6", label: "Entry Nodes", accent: true },
		{ value: "3", label: "Learning Modes", accent: false },
		{ value: `${formatCompact(heroStats.notesIndexed)}+`, label: "Notes", accent: true },
		{ value: `${Math.max(20, categories.length)}+`, label: "Domains", accent: false },
	];

	return (
		<section className={styles.page}>
			<div className={styles.contentWrap}>
				<div className={styles.ticker}>
					<span className={styles.tickerLabel}>Trending</span>
					<div className={styles.tickerTrack}>
						<div className={styles.tickerScroll}>
							{doubledTopics.map((topic, i) => (
								<span key={`${topic}-${i}`} className={styles.tickerItem}>
									<span className={styles.tickerHash}>#</span>
									{topic}
								</span>
							))}
						</div>
					</div>
				</div>

				<section className={styles.hero}>
					<div className={styles.heroRadial} aria-hidden="true" />

					<div className={styles.heroPill}>
						<span className={styles.pillDot} />
						Home Hub — community-powered learning
					</div>

					<h1 className={styles.heroTitle}>
						The programmer&apos;s
						<br />
						library, <em>reimagined</em>
					</h1>

					<p className={styles.heroSub}>
						Your central graph for library discovery, curated learning, MCQ practice, and open contributions.
					</p>

					<form action="/search" method="GET" className={styles.searchWrap}>
						<span className={styles.searchHint}>{"⌘K"}</span>
						<input
							className={styles.searchBox}
							type="text"
							name="q"
							data-global-search-input="true"
							placeholder="Search notes, videos, categories, tracks..."
						/>
						<button type="submit" className={styles.searchSubmit}>Search</button>
					</form>

					{searchTags.length > 0 ? (
						<div className={styles.searchTags}>
							{searchTags.map((tag) => (
								<Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className={styles.searchTag}>
									{tag}
								</Link>
							))}
						</div>
					) : null}

					<div className={styles.statsBar}>
						{stats.map((stat) => (
							<div key={stat.label} className={styles.statItem}>
								<div className={`${styles.statNum} ${stat.accent ? styles.statAccent : ""}`}>{stat.value}</div>
								<div className={styles.statLabel}>{stat.label}</div>
							</div>
						))}
					</div>
				</section>

				<div className={styles.sectionHeader}>
					<p className={styles.eyebrow}>Learning Graph</p>
					<h2 className={styles.sectionTitle}>Pick any node. Build anything.</h2>
					<p className={styles.sectionDesc}>Every path remains connected to your next learning action.</p>
				</div>
				<div className={styles.twoCol}>
					<div className={styles.cardsGrid}>
							{NODES.map((node) => (
								<article key={node.title} className={styles.graphCard}>
									<div className={styles.cardTop}>
										<span className={`${styles.badge} ${node.badgeClass}`}>{node.badge}</span>
										<span className={styles.cardMeta}>{node.meta}</span>
									</div>
									<h3 className={styles.cardTitle}>{node.title}</h3>
									<p className={styles.cardDesc}>{node.description}</p>
									{node.contribute ? (
										<ContributeCtaLink href={node.href} className={styles.cardCta} source="home-graph-card">
											{node.cta}
										</ContributeCtaLink>
									) : (
										<Link href={node.href} className={styles.cardCta}>
											{node.cta}
										</Link>
									)}
								</article>
							))}
						</div>

					<HomeSidebarAccordion
						trendingTopics={trendingTopics}
						liveActivity={liveActivity}
						topContributors={topContributors}
					/>
				</div>

				<div className={styles.flowBar}>
					{FLOW_STEPS.map((step, index) => (
						<span
							key={step}
							className={`${styles.flowStep} ${index === 0 ? styles.activeFlowStep : ""}`}
						>
							{step}
						</span>
					))}
				</div>

			</div>
		</section>
	);
}
