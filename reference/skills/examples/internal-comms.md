# Internal Comms — Source Skill

On-demand file from the dump: `/mnt/skills/examples/internal-comms/SKILL.md`. Source text is presented as readable Markdown; this is reference material, not an installed skill.

[Home](../../../README.md) · [Original source](https://github.com/elder-plinius/CL4R1T4S/blob/84cd1bf98a8bc395cdcd44b9f420484d0d60881a/ANTHROPIC/CLAUDE-CODE-FABLE-5.2.txt)

---

<details>
<summary>Source skill metadata</summary>

```yaml
name: internal-comms
description: A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports, leadership updates, 3P updates, company newsletters, FAQs, incident reports, project updates, etc.).
license: Complete terms in LICENSE.txt
```

</details>

### When to use this skill
To write internal communications, use this skill for:
- 3P updates (Progress, Plans, Problems)
- Company newsletters
- FAQ responses
- Status reports
- Leadership updates
- Project updates
- Incident reports

### How to use this skill

To write any internal communication:

1. **Identify the communication type** from the request
2. **Load the appropriate guideline file** from the `examples/` directory:
    - `examples/3p-updates.md` - For Progress/Plans/Problems team updates
    - `examples/company-newsletter.md` - For company-wide newsletters
    - `examples/faq-answers.md` - For answering frequently asked questions
    - `examples/general-comms.md` - For anything else that doesn't explicitly match one of the above
3. **Follow the specific instructions** in that file for formatting, tone, and content gathering

If the communication type doesn't match any existing guideline, ask for clarification or more context about the desired format.

### Keywords
3P updates, company newsletter, company comms, weekly update, faqs, common questions, updates, internal comms
