// On-demand performance audit (not run in CI). BASE_URL picks the target: a local build, staging or production.
const base = (process.env.BASE_URL || "http://localhost:4321").replace(/\/+$/, "");
const paths = [
  "/",
  "/blog",
  "/blog/2026-year-of-divine-acceleration",
  "/capsules/today",
  "/events",
  "/books",
];

module.exports = {
  ci: {
    collect: {
      url: paths.map((p) => base + p),
      numberOfRuns: 3,
      settings: { onlyCategories: ["performance"] },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
        "largest-contentful-paint": [
          "error",
          { maxNumericValue: 2500, aggregationMethod: "median-run" },
        ],
        "cumulative-layout-shift": [
          "error",
          { maxNumericValue: 0.1, aggregationMethod: "median-run" },
        ],
        "total-blocking-time": ["error", { maxNumericValue: 300, aggregationMethod: "median-run" }],
        "resource-summary:script:size": ["error", { maxNumericValue: 150000 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouse" },
  },
};
