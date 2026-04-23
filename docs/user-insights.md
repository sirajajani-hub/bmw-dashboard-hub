# User Insights

The dashboard reads manual Key Observations overrides from [user-insights.json](/Users/siraj.ajani/Desktop/Siraj's Project Files/Projects/bmw-tableau-hub/docs/user-insights.json).

Rules:
- Match is exact on `region`, `maco`, `quarter`, and `channel`.
- Only `optimizations` and `recommendations` are supported.
- If a matching entry is found, that section replaces the generated bullet(s).
- If one section is omitted, the dashboard keeps the generated section.
- If a section is present with an empty array, that section is suppressed for that entry.

Example:

```json
[
  {
    "region": "T2EAST",
    "maco": "ALL MACOS",
    "quarter": "Q4 2025",
    "channel": "Search",
    "optimizations": [
      "Optimize Bing Ads / CPO to reduce cost per KBA while maintaining volume."
    ],
    "recommendations": [
      "Scale Google non-brand where KBA efficiency remains below benchmark."
    ]
  },
  {
    "region": "T2EAST",
    "maco": "ALL MACOS",
    "quarter": "Q4 2025",
    "channel": "Social",
    "optimizations": [
      "Reduce spend on low-efficiency audience clusters."
    ],
    "recommendations": [
      "Shift incremental budget toward high-KBA prospecting campaigns."
    ]
  }
]
```
