import Link from "next/link";
import ContributeCtaLink from "@/components/ContributeCtaLink";
import {
	getCategories,
	getLatestApprovedNotesActivity,
	getLibraryHeroStats,
	getTopContributors,
} from "@/lib/db/queries";
import styles from "./page.module.css";

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

const QUICK_TAGS = ["Python", "DSA", "System Design", "SQL", "Docker", "React"];

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
	const [categories, heroStats, latestActivity, topContributorRows] = await Promise.all([
		getCategories(10),
		getLibraryHeroStats(),
		getLatestApprovedNotesActivity(4),
		getTopContributors(3),
	]);

	const topicNames = categories.map((category) => category.name).filter(Boolean);
	const topics = topicNames.length > 0 ? topicNames : QUICK_TAGS;
	const doubledTopics = [...topics, ...topics];

	const trendingTopics = categories.slice(0, 5).map((category, index) => ({
		rank: index + 1,
		name: category.name,
		count: `${category.noteCount} notes`,
		up: index < 3,
	}));

	const liveActivity = latestActivity.map((note, index) => ({
		name: note.author || "Community member",
		title: note.title,
		time: formatRelativeTime(note.createdAt),
		initials: initials(note.author || "xreso"),
		color: AVATAR_COLORS[index % AVATAR_COLORS.length],
	}));

	const topContributors = topContributorRows.map((row, index) => ({
		name: row.name,
		noteText: `${row.noteCount} note${row.noteCount === 1 ? "" : "s"} shared`,
		pointsText: `${row.points} pts`,
		initials: initials(row.name),
		color: AVATAR_COLORS[index % AVATAR_COLORS.length],
	}));

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

					<form action="/browse" method="GET" className={styles.searchWrap}>
						<span className={styles.searchIcon}>⌕</span>
						<input
							className={styles.searchBox}
							type="text"
							name="q"
							placeholder="Search notes, topics, languages..."
						/>
						<span className={styles.searchKbd}>{"⌘K"}</span>
					</form>

					<div className={styles.searchTags}>
						{QUICK_TAGS.map((tag) => (
							<Link key={tag} href={`/browse?q=${encodeURIComponent(tag)}`} className={styles.searchTag}>
								{tag}
							</Link>
						))}
					</div>

					<div className={styles.statsBar}>
						{stats.map((stat) => (
							<div key={stat.label} className={styles.statItem}>
								<div className={`${styles.statNum} ${stat.accent ? styles.statAccent : ""}`}>{stat.value}</div>
								<div className={styles.statLabel}>{stat.label}</div>
							</div>
						))}
					</div>
				</section>

				<div className={styles.twoCol}>
					<div>
						<div className={styles.sectionHeader}>
							<p className={styles.eyebrow}>Learning Graph</p>
							<h2 className={styles.sectionTitle}>Pick any node. Build anything.</h2>
							<p className={styles.sectionDesc}>Every path remains connected to your next learning action.</p>
						</div>

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
					</div>

					<aside className={styles.sidebar}>
						<div className={styles.sidebarBox}>
							<div className={styles.sidebarBoxHeader}>
								<span className={styles.sidebarBoxTitle}>Trending Topics</span>
								<Link href="/categories" className={styles.sidebarBoxMore}>{"See all →"}</Link>
							</div>
							{trendingTopics.map((topic) => (
								<div key={topic.name} className={styles.trendItem}>
									<span className={styles.trendRank}>{topic.rank}</span>
									<span className={styles.trendName}>{topic.name}</span>
									<span className={styles.trendCount}>{topic.count}</span>
									{topic.up && <span className={styles.trendUp}>↑</span>}
								</div>
							))}
						</div>

						<div className={styles.sidebarBox}>
							<div className={styles.sidebarBoxHeader}>
								<span className={styles.sidebarBoxTitle}>Live Activity</span>
							</div>
							{liveActivity.map((activity) => (
								<div key={`${activity.name}-${activity.time}`} className={styles.activityItem}>
									<div className={`${styles.avatar} ${activity.color}`}>{activity.initials}</div>
									<div className={styles.activityBody}>
										<p className={styles.activityText}>
											<strong>{activity.name}</strong> added note on <span className={styles.activityTag}>{activity.title}</span>
										</p>
										<span className={styles.activityTime}>{activity.time}</span>
									</div>
								</div>
							))}
						</div>

						<div className={styles.sidebarBox}>
							<div className={styles.sidebarBoxHeader}>
								<span className={styles.sidebarBoxTitle}>Top Contributors</span>
								<span className={styles.sidebarBoxMore}>{"View all →"}</span>
							</div>
							{topContributors.map((contributor) => (
								<div key={contributor.name} className={styles.contributorItem}>
									<div className={`${styles.avatar} ${contributor.color}`}>{contributor.initials}</div>
									<div className={styles.contributorInfo}>
										<p className={styles.contributorName}>{contributor.name}</p>
										<p className={styles.contributorRole}>{contributor.noteText}</p>
									</div>
									<span className={styles.contributorScore}>{contributor.pointsText}</span>
								</div>
							))}
						</div>
					</aside>
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
