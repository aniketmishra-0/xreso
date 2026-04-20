const DEFAULT_SITE_URL = "https://www.xresoinc.com";

function normalizeSiteUrl(rawUrl?: string): string {
	const candidate = rawUrl?.trim();
	if (!candidate) return DEFAULT_SITE_URL;

	const withProtocol = /^https?:\/\//i.test(candidate)
		? candidate
		: `https://${candidate}`;

	try {
		const url = new URL(withProtocol);
		return url.toString().replace(/\/$/, "");
	} catch {
		return DEFAULT_SITE_URL;
	}
}

export const SITE_URL = normalizeSiteUrl(
	process.env.NEXT_PUBLIC_APP_URL ||
		(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
);

export const SITE_HOST = new URL(SITE_URL).host;
