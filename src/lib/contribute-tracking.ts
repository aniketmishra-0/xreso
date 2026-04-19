export type ContributeClickEvent = {
  event: "contribute_click";
  source: string;
  timestamp: number;
};

export function trackContributeClick(source: string) {
  if (typeof window === "undefined") return;

  const payload: ContributeClickEvent = {
    event: "contribute_click",
    source,
    timestamp: Date.now(),
  };

  // TODO: replace with your analytics provider.
  console.log(payload);
}
