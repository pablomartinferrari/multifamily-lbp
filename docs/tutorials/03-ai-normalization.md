# Tutorial 3: Understanding AI Normalization

**Duration:** 5-6 minutes  
**Target Audience:** All users  
**Prerequisites:** Basic understanding of XRF inspection data

---

## Script

### Scene 1: Introduction (0:00 - 0:30)

**[VISUAL]** Show messy component names in raw data vs. clean normalized names

**[NARRATION]**
> "One of the biggest challenges in XRF inspection data is inconsistency. Different inspectors write component names differently—'door jamb', 'dr jamb', 'Door Jamb', 'doorjamb'. They all mean the same thing, but they look different in your data.
>
> In this video, you'll learn how our AI normalization solves this problem automatically."

---

### Scene 2: The Problem (0:30 - 1:15)

**[VISUAL]** Show Excel data with inconsistent names highlighted

**[NARRATION]**
> "Let's look at a real example. Here's raw inspection data from a multifamily property."

**[VISUAL]** Circle various spellings:
- "clos. wall"
- "closet wall"
- "Closet Wall"
- "cls wall"

> "Notice how 'closet wall' appears four different ways? Without normalization, your reports would treat these as four different components. That means:
> - Inaccurate grouping
> - Misleading statistics  
> - Non-compliant reports
>
> Manually fixing this is tedious and error-prone. That's where AI comes in."

---

### Scene 3: How AI Normalization Works (1:15 - 2:15)

**[VISUAL]** Animated diagram showing the process

**[NARRATION]**
> "Here's how our AI normalization works:"

**[VISUAL]** Step 1: Extract
> "**Step 1**: The system extracts all unique component and substrate names from your file."

**[VISUAL]** Step 2: Check Cache
> "**Step 2**: It checks our cache of previously normalized names. If we've seen 'dr jamb' before, we already know it maps to 'Door Jamb'."

**[VISUAL]** Step 3: AI Processing
> "**Step 3**: For new names, AI analyzes them and groups similar terms together, choosing a canonical—or standard—name for each group."

**[VISUAL]** Step 4: Apply
> "**Step 4**: The normalized names are applied to your data, and the mappings are cached for future use."

**[VISUAL]** Show before/after comparison
> "The result? Clean, consistent data ready for accurate reporting."

---

### Scene 4: Component Normalization Examples (2:15 - 3:15)

**[VISUAL]** Show component normalization examples in a table

**[NARRATION]**
> "Let's see some examples of component normalization:"

**[VISUAL]** Show transformation table:

| Original | Normalized |
|----------|------------|
| dr jamb | Door Jamb |
| door-jamb | Door Jamb |
| doorjamb | Door Jamb |
| clos. wall | Closet Wall |
| closet wall | Closet Wall |
| win sill | Window Sill |
| window sil | Window Sill |

> "Notice how abbreviations, punctuation differences, and spelling variations all resolve to the same clean name. The AI understands these are the same building component."

---

### Scene 5: Substrate Normalization (3:15 - 4:00)

**[VISUAL]** Show substrate normalization examples

**[NARRATION]**
> "The system also normalizes substrate names—the surface materials where readings are taken."

**[VISUAL]** Show substrate examples:

| Original | Normalized |
|----------|------------|
| wd | Wood |
| wood | Wood |
| hardwood | Wood |
| mtl | Metal |
| steel | Metal |
| sheetrock | Drywall |
| gypsum board | Drywall |

> "Common abbreviations like 'wd' for wood and 'mtl' for metal are expanded. Synonyms like 'sheetrock' and 'gypsum board' are unified as 'Drywall'.
>
> This is important because readings are now grouped by component AND substrate together."

---

### Scene 6: The Caching System (4:00 - 4:45)

**[VISUAL]** Show diagram of cache flow

**[NARRATION]**
> "Here's something that makes processing faster over time: caching."

**[VISUAL]** Highlight SharePoint lists
> "Every normalization is saved to SharePoint. The next time you upload a file with 'dr jamb', the system instantly knows it's 'Door Jamb'—no AI call needed."

**[VISUAL]** Show speed comparison
> "This means:
> - Faster processing on subsequent uploads
> - Consistent normalizations across all jobs
> - Lower AI costs for your organization
>
> The more you use the system, the smarter it gets!"

---

### Scene 7: Reviewing Normalizations (4:45 - 5:30)

**[VISUAL]** Show the AI Normalization Review panel

**[NARRATION]**
> "After AI processing, you can review the normalizations before they're applied."

**[VISUAL]** Highlight the review list
> "This panel shows you exactly what changes will be made. Each row shows the original name and its normalized form."

**[VISUAL]** Show confidence scores
> "Confidence scores indicate how certain the AI is about each normalization. Higher is better."

**[VISUAL]** Click Approve
> "When you're satisfied, click **Approve** to apply the normalizations. Or use **Cancel** if you need to make manual changes first."

---

### Scene 8: Wrap Up (5:30 - 6:00)

**[VISUAL]** Show clean, normalized data grid

**[NARRATION]**
> "AI normalization is one of the most powerful features of the XRF Processor. It saves you hours of manual cleanup and ensures your reports are accurate and compliant.
>
> In the next video, we'll show you how to review your data and make edits when needed."

**[VISUAL]** End card

---

## Key Points to Emphasize

1. AI handles abbreviations, synonyms, and spelling variations
2. Both components AND substrates are normalized
3. Caching makes repeat processing faster
4. Users can review and approve normalizations

## Demo Data Needed

- File with intentionally varied component names
- Mix of abbreviated and full substrate names
- Some unusual spellings to show AI capability
