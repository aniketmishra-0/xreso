"use client";

import { useState } from "react";
import styles from "./page.module.css";

type TrendingTopic = {
	rank: number;
	name: string;
	count: string;
	up: boolean;
};

type ActivityItem = {
	name: string;
	title: string;
	time: string;
	initials: string;
	color: string;
};

type ContributorItem = {
	name: string;
	noteText: string;
	initials: string;
	color: string;
};

type SidebarPanel = "trending" | "activity" | "contributors";

type HomeSidebarAccordionProps = {
	trendingTopics: TrendingTopic[];
	liveActivity: ActivityItem[];
	topContributors: ContributorItem[];
};

export default function HomeSidebarAccordion({
	trendingTopics,
	liveActivity,
	topContributors,
}: HomeSidebarAccordionProps) {
	const [openPanel, setOpenPanel] = useState<SidebarPanel>(() => {
		if (liveActivity.length > 0) return "activity";
		if (topContributors.length > 0) return "contributors";
		return "trending";
	});

	return (
		<aside className={styles.sidebar}>
			<section className={`${styles.sidebarBox} ${openPanel === "trending" ? styles.sidebarBoxOpen : ""}`}>
				<button
					type="button"
					className={styles.sidebarPanelToggle}
					onClick={() => setOpenPanel("trending")}
					aria-expanded={openPanel === "trending"}
					aria-controls="home-sidebar-trending"
				>
					<span className={styles.sidebarBoxTitle}>Trending Topics</span>
					<span className={styles.sidebarPanelToggleMeta}>
						<span className={styles.sidebarBoxMeta}>Top 5</span>
						<span
							className={`${styles.sidebarPanelCaret} ${openPanel === "trending" ? styles.sidebarPanelCaretOpen : ""}`}
							aria-hidden="true"
						>
							&gt;
						</span>
					</span>
				</button>

				{openPanel === "trending" ? (
					<div id="home-sidebar-trending" className={styles.sidebarPanelBody}>
						{trendingTopics.length > 0 ? (
							trendingTopics.map((topic) => (
								<div key={`${topic.name}-${topic.rank}`} className={styles.trendItem}>
									<span className={styles.trendRank}>{topic.rank}</span>
									<span className={styles.trendName}>{topic.name}</span>
									<span className={styles.trendCount}>{topic.count}</span>
									{topic.up && <span className={styles.trendUp}>^</span>}
								</div>
							))
						) : (
							<p className={styles.sidebarEmpty}>No trending topics yet.</p>
						)}
					</div>
				) : null}
			</section>

			<section className={`${styles.sidebarBox} ${openPanel === "activity" ? styles.sidebarBoxOpen : ""}`}>
				<button
					type="button"
					className={styles.sidebarPanelToggle}
					onClick={() => setOpenPanel("activity")}
					aria-expanded={openPanel === "activity"}
					aria-controls="home-sidebar-activity"
				>
					<span className={styles.sidebarBoxTitle}>Live Activity</span>
					<span className={styles.sidebarPanelToggleMeta}>
						<span className={styles.sidebarBoxMeta}>Latest 5</span>
						<span
							className={`${styles.sidebarPanelCaret} ${openPanel === "activity" ? styles.sidebarPanelCaretOpen : ""}`}
							aria-hidden="true"
						>
							&gt;
						</span>
					</span>
				</button>

				{openPanel === "activity" ? (
					<div id="home-sidebar-activity" className={styles.sidebarPanelBody}>
						{liveActivity.length > 0 ? (
							liveActivity.map((activity, index) => (
								<div key={`${activity.name}-${activity.time}-${index}`} className={styles.activityItem}>
									<div className={`${styles.avatar} ${activity.color}`}>{activity.initials}</div>
									<div className={styles.activityBody}>
										<p className={styles.activityText}>
											<strong>{activity.name}</strong> added note on <span className={styles.activityTag}>{activity.title}</span>
										</p>
										<span className={styles.activityTime}>{activity.time}</span>
									</div>
								</div>
							))
						) : (
							<p className={styles.sidebarEmpty}>No recent activity yet.</p>
						)}
					</div>
				) : null}
			</section>

			<section className={`${styles.sidebarBox} ${openPanel === "contributors" ? styles.sidebarBoxOpen : ""}`}>
				<button
					type="button"
					className={styles.sidebarPanelToggle}
					onClick={() => setOpenPanel("contributors")}
					aria-expanded={openPanel === "contributors"}
					aria-controls="home-sidebar-contributors"
				>
					<span className={styles.sidebarBoxTitle}>Top Contributors</span>
					<span className={styles.sidebarPanelToggleMeta}>
						<span className={styles.sidebarBoxMeta}>Top 5</span>
						<span
							className={`${styles.sidebarPanelCaret} ${openPanel === "contributors" ? styles.sidebarPanelCaretOpen : ""}`}
							aria-hidden="true"
						>
							&gt;
						</span>
					</span>
				</button>

				{openPanel === "contributors" ? (
					<div id="home-sidebar-contributors" className={styles.sidebarPanelBody}>
						{topContributors.length > 0 ? (
							topContributors.map((contributor, index) => (
								<div key={`${contributor.name}-${index}`} className={styles.contributorItem}>
									<div className={`${styles.avatar} ${contributor.color}`}>{contributor.initials}</div>
									<div className={styles.contributorInfo}>
										<p className={styles.contributorName}>{contributor.name}</p>
										<p className={styles.contributorRole}>{contributor.noteText}</p>
									</div>
								</div>
							))
						) : (
							<p className={styles.sidebarEmpty}>No contributors yet.</p>
						)}
					</div>
				) : null}
			</section>
		</aside>
	);
}
