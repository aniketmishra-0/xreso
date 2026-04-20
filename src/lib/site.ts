const DEFAULT_SITE_URL = "https://xresoinc.com";

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SITE_URL;
export const SITE_HOST = new URL(SITE_URL).host;
