---
name: grilling
description: Stress-test a plan or decision through focused rounds of consequential questions when the user asks to be grilled ("grill me").
---

Identify the decisions that could change the plan. Research facts from available sources before asking the user.

Ask independent questions together, with a recommendation and reason for each. Defer questions that depend on an earlier answer. Stop when the remaining uncertainty would not change the decision.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Ask the user to choose only decisions they own. Summarize the resolved plan before acting on it.
