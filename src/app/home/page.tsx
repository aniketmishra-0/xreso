import Link from "next/link";
import styles from "./page.module.css";

const HUB_ITEMS = [
	{
		title: "Library",
		description: "Browse handwritten notes by topic, language, and community tags.",
		href: "/browse",
		cta: "Open Library",
	},
	{
		title: "Videos",
		description: "Watch curated programming videos with language and topic filters.",
		href: "/videos",
		cta: "Watch Videos",
	},
	{
		title: "MCQ",
		description: "Practice quick multiple-choice quizzes and sharpen core concepts.",
		href: "/mcq",
		cta: "Start MCQ",
	},
	{
		title: "Upload",
		description: "Share your notes, links, and video resources with the community.",
		href: "/upload",
		cta: "Contribute",
	},
	{
		title: "Categories",
		description: "Jump directly to focused tracks like Python, SQL, DSA, and more.",
		href: "/categories",
		cta: "View Categories",
	},
	{
		title: "Advanced",
		description: "Explore cloud and system design resources in advanced tracks.",
		href: "/tracks",
		cta: "Open Advanced",
	},
];

export default function HomeHubPage() {
	return (
		<section className={styles.page}>
			<div className={styles.hero}>
				<p className={styles.eyebrow}>HOME HUB</p>
				<h1 className={styles.title}>Welcome to xreso</h1>
				<p className={styles.subtitle}>
					Use this page as your central launchpad for Library, Videos, MCQ practice, and uploads.
				</p>
			</div>

			<div className={styles.grid}>
				{HUB_ITEMS.map((item) => (
					<article key={item.title} className={styles.card}>
						<h2 className={styles.cardTitle}>{item.title}</h2>
						<p className={styles.cardDescription}>{item.description}</p>
						<Link href={item.href} className={styles.cardCta}>
							{item.cta}
						</Link>
					</article>
				))}
			</div>
		</section>
	);
}
