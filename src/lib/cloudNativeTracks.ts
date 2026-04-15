export type TrackLevel = "Beginner" | "Intermediate" | "Advanced";

export interface CloudNativeTopic {
  slug: string;
  name: string;
  blurb: string;
  query: string;
  level: TrackLevel;
}

export interface CloudNativeTrack {
  slug: "kubernetes" | "devops" | "system-design";
  name: string;
  description: string;
  goal: string;
  starterQuery: string;
  noteCategorySlug?: string;
  topics: CloudNativeTopic[];
}

export const CLOUD_NATIVE_TRACKS: CloudNativeTrack[] = [
  {
    slug: "kubernetes",
    name: "Kubernetes",
    description: "Container orchestration, cluster operations, and production deployment workflows.",
    goal: "Move from local Docker apps to resilient, autoscaled production workloads.",
    starterQuery: "kubernetes",
    topics: [
      {
        slug: "k8s-fundamentals",
        name: "Cluster Fundamentals",
        blurb: "Pods, Deployments, ReplicaSets, and config management basics.",
        query: "kubernetes",
        level: "Beginner",
      },
      {
        slug: "k8s-services-networking",
        name: "Services and Networking",
        blurb: "Service types, ingress, DNS, and traffic routing patterns.",
        query: "kubernetes ingress",
        level: "Intermediate",
      },
      {
        slug: "k8s-security",
        name: "Security and Policies",
        blurb: "RBAC, secrets, policy controls, and workload isolation.",
        query: "kubernetes security",
        level: "Intermediate",
      },
      {
        slug: "k8s-observability",
        name: "Observability and Troubleshooting",
        blurb: "Logs, metrics, probes, and production debugging workflows.",
        query: "kubernetes monitoring",
        level: "Advanced",
      },
      {
        slug: "k8s-release",
        name: "Helm and Release Strategy",
        blurb: "Templated deployments, versioning, and rollback-safe releases.",
        query: "helm kubernetes",
        level: "Advanced",
      },
    ],
  },
  {
    slug: "devops",
    name: "DevOps",
    description: "Automation, CI/CD, IaC, and platform reliability for delivery teams.",
    goal: "Build a repeatable delivery pipeline from code commit to stable production.",
    starterQuery: "devops",
    noteCategorySlug: "devops",
    topics: [
      {
        slug: "linux-shell",
        name: "Linux and Shell",
        blurb: "Linux internals, permissions, processes, and practical shell commands.",
        query: "linux",
        level: "Beginner",
      },
      {
        slug: "git-cicd",
        name: "Git and CI/CD",
        blurb: "Branching strategy, build pipelines, testing gates, and deployments.",
        query: "ci cd",
        level: "Beginner",
      },
      {
        slug: "docker-runtime",
        name: "Docker and Runtime Operations",
        blurb: "Container lifecycle, image hardening, and runtime best practices.",
        query: "docker",
        level: "Intermediate",
      },
      {
        slug: "ansible-automation",
        name: "Ansible Automation",
        blurb: "Playbooks, roles, inventory design, and idempotent infrastructure tasks.",
        query: "ansible",
        level: "Intermediate",
      },
      {
        slug: "terraform-iac",
        name: "Terraform and Infrastructure as Code",
        blurb: "Provision cloud infrastructure safely with reusable modules.",
        query: "terraform",
        level: "Advanced",
      },
      {
        slug: "monitoring-sre",
        name: "Monitoring, SRE, and Incident Response",
        blurb: "SLIs, alerts, on-call readiness, and post-incident reviews.",
        query: "monitoring",
        level: "Advanced",
      },
    ],
  },
  {
    slug: "system-design",
    name: "System Design",
    description: "Designing scalable, reliable systems and communication between services.",
    goal: "Convert product requirements into architecture decisions with clear tradeoffs.",
    starterQuery: "system design",
    topics: [
      {
        slug: "requirements-capacity",
        name: "Requirements and Capacity Planning",
        blurb: "Estimate scale, define constraints, and set architectural boundaries.",
        query: "capacity planning",
        level: "Beginner",
      },
      {
        slug: "api-data-modeling",
        name: "API and Data Modeling",
        blurb: "Design APIs, choose data contracts, and model domain entities.",
        query: "api design",
        level: "Intermediate",
      },
      {
        slug: "database-caching",
        name: "Databases and Caching",
        blurb: "Pick storage engines and caching layers for performance and consistency.",
        query: "database caching",
        level: "Intermediate",
      },
      {
        slug: "async-distributed",
        name: "Async and Distributed Patterns",
        blurb: "Queues, pub-sub, retries, idempotency, and eventual consistency.",
        query: "distributed systems",
        level: "Advanced",
      },
      {
        slug: "resilience-observability",
        name: "Reliability and Observability",
        blurb: "Failure handling, fallback strategy, tracing, and resilience testing.",
        query: "observability",
        level: "Advanced",
      },
    ],
  },
];

export const CLOUD_NATIVE_TRACK_SLUGS = new Set(
  CLOUD_NATIVE_TRACKS.map((track) => track.slug)
);
