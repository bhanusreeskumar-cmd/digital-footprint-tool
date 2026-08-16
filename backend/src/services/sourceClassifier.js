const RULES = [
  {
    id: "data-broker",
    category: "data-broker",
    patterns: [
      /people\s*search/i,
      /background\s*check/i,
      /data\s*broker/i,
      /find\s*people/i,
      /public\s*records/i,
    ],
    domains: [
      "192.com",
      "spokeo.com",
      "whitepages.com",
      "beenverified.com",
      "peoplefinder.com",
    ],
    dpcFloor: 1,
    exploitativeAggregator: true,
    reach: 0.5,
    reason:
      "The source appears to be designed to aggregate or expose personal information.",
  },

  {
    id: "health-sensitive",
    category: "healthcare-sensitive",
    patterns: [
      /diabetes/i,
      /oncology/i,
      /mental\s*health/i,
      /fertility/i,
      /sexual\s*health/i,
      /addiction/i,
      /\bhiv\b/i,
    ],
    domains: [],
    dpcFloor: 3,
    exploitativeAggregator: false,
    reach: 0.25,
    reason:
      "The source context may allow sensitive health-related inferences.",
  },

  {
    id: "health-general",
    category: "healthcare",
    patterns: [
      /\bpharmacy\b/i,
      /\bclinic\b/i,
      /\bhospital\b/i,
      /\bmedical\b/i,
      /\bhealthcare\b/i,
    ],
    domains: [],
    dpcFloor: 2,
    exploitativeAggregator: false,
    reach: 0.25,
    reason:
      "The source is healthcare-related and can make otherwise simple identifiers more revealing.",
  },

  {
    id: "financial",
    category: "financial",
    patterns: [
      /\bbank\b/i,
      /\binvestment\b/i,
      /\bmortgage\b/i,
      /credit\s*card/i,
      /\bfinancial\b/i,
    ],
    domains: [],
    dpcFloor: 3,
    exploitativeAggregator: false,
    reach: 0.25,
    reason:
      "The source is financial in nature.",
  },

  {
    id: "sensitive-community",
    category: "sensitive-community",
    patterns: [
      /political\s*party/i,
      /religious\s*group/i,
      /\bdating\b/i,
      /sexual\s*orientation/i,
    ],
    domains: [],
    dpcFloor: 3,
    exploitativeAggregator: false,
    reach: 0.25,
    reason:
      "The source context may reveal sensitive personal characteristics.",
  },

  {
    id: "social",
    category: "social-media",
    patterns: [],
    domains: [
      "facebook.com",
      "instagram.com",
      "linkedin.com",
      "x.com",
      "twitter.com",
      "tiktok.com",
    ],
    dpcFloor: 1,
    exploitativeAggregator: false,
    reach: 0.5,
    reason:
      "The result is publicly indexed social-media content.",
  },

  {
    id: "professional",
    category: "professional-education",
    patterns: [
      /\buniversity\b/i,
      /\bcollege\b/i,
      /\bschool\b/i,
      /\bconference\b/i,
      /\bstaff\b/i,
      /\bfaculty\b/i,
    ],
    domains: [],
    dpcFloor: 1,
    exploitativeAggregator: false,
    reach: 0.25,
    reason:
      "The source appears professional or educational.",
  },

  {
    id: "general",
    category: "general-web",
    patterns: [],
    domains: [],
    dpcFloor: 1,
    exploitativeAggregator: false,
    reach: 0.25,
    reason:
      "No higher-risk source category was confidently detected.",
  },
];

export function classifySource(page) {
  const relevantText = [
    page.domain || "",
    page.title || "",
    page.snippet || "",
  ].join(" ");

  for (const rule of RULES) {
    const domainMatch = rule.domains.some(
      (domain) =>
        page.domain === domain ||
        page.domain.endsWith(`.${domain}`)
    );

    const textMatch = rule.patterns.some((pattern) =>
      pattern.test(relevantText)
    );

    if (
      domainMatch ||
      textMatch ||
      rule.id === "general"
    ) {
      return rule;
    }
  }
}