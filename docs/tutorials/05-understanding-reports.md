# Tutorial 5: Understanding HUD/EPA Reports

**Duration:** 6-7 minutes  
**Target Audience:** Inspectors, Property Managers  
**Prerequisites:** Understanding of lead paint inspection basics

---

## Script

### Scene 1: Introduction (0:00 - 0:30)

**[VISUAL]** Show the summary report interface

**[NARRATION]**
> "The ultimate goal of the XRF Processor is to generate HUD and EPA compliant lead paint inspection summaries. In this video, we'll explain exactly what these reports mean and how to interpret them."

---

### Scene 2: Generating a Summary (0:30 - 1:00)

**[VISUAL]** Show the Generate Summary button

**[NARRATION]**
> "Once you've reviewed your data, click the **Generate Summary** button."

**[VISUAL]** Click button, show processing
> "The system analyzes all your readings and classifies them according to HUD and EPA guidelines."

**[VISUAL]** Show completed summary
> "Here's your completed summary report. Let's break down each section."

---

### Scene 3: The Lead Content Threshold (1:00 - 1:45)

**[VISUAL]** Show threshold explanation graphic

**[NARRATION]**
> "Before we look at the categories, let's understand the basic threshold.
>
> According to HUD guidelines, any reading with lead content **at or above 1.0 milligrams per square centimeter** is considered positive for lead paint."

**[VISUAL]** Show examples:
- 0.8 mg/cm² → Negative
- 1.0 mg/cm² → Positive
- 2.5 mg/cm² → Positive

> "Below this threshold is negative. At or above is positive. Simple."

---

### Scene 4: The 40-Reading Threshold (1:45 - 2:30)

**[VISUAL]** Show 40-reading threshold explanation

**[NARRATION]**
> "Now here's where HUD/EPA guidelines get more specific. How readings are classified depends on **how many readings you have** for each component/substrate combination."

**[VISUAL]** Show two paths:
- 40+ readings → Statistical Averaging
- Less than 40 → Individual Classification

> "If you have **40 or more readings** for a component/substrate combination, you use statistical averaging—also called the 'Average Components' method.
>
> If you have **fewer than 40 readings**, each component is classified individually as either 'Uniform' or 'Non-Uniform'."

---

### Scene 5: Average Components (40+ Readings) (2:30 - 3:30)

**[VISUAL]** Show Average Components section of report

**[NARRATION]**
> "Let's look at **Average Components** first. These are component/substrate combinations with 40 or more readings."

**[VISUAL]** Highlight the 2.5% threshold
> "For these, we use the **2.5% rule**:
> - If MORE than 2.5% of readings are positive, the component is marked **POSITIVE**
> - If 2.5% OR LESS are positive, the component is marked **NEGATIVE**"

**[VISUAL]** Show example:
> "For example: Door Frame (Wood) has 45 readings. 2 are positive, that's 4.4%. Since 4.4% is greater than 2.5%, the whole component is marked POSITIVE for lead paint."

**[VISUAL]** Show another example:
> "But Window Sill (Wood) has 50 readings with only 1 positive—that's 2%. Since 2% is less than 2.5%, it's marked NEGATIVE even though there's one positive reading."

> "This statistical approach makes sense for large sample sizes and is specifically allowed by HUD guidelines."

---

### Scene 6: Uniform Components (<40 Readings) (3:30 - 4:15)

**[VISUAL]** Show Uniform Components section

**[NARRATION]**
> "Now let's look at **Uniform Components**. These have fewer than 40 readings, and here's the key: **all readings have the same result**."

**[VISUAL]** Highlight examples:
- "Baseboard (Wood): 15 readings, ALL negative → NEGATIVE"
- "Cabinet (Wood): 8 readings, ALL positive → POSITIVE"

> "If every single reading for a component is negative, the component is Uniform Negative. If every reading is positive, it's Uniform Positive.
>
> This is straightforward—consistency in results means clear classification."

---

### Scene 7: Non-Uniform Components (4:15 - 5:15)

**[VISUAL]** Show Non-Uniform Components section with warning

**[NARRATION]**
> "The most complex category is **Non-Uniform Components**. These have fewer than 40 readings AND a mix of positive and negative results."

**[VISUAL]** Highlight warning message
> "Notice the warning bar. These components require special attention because we can't use statistical averaging, and results aren't consistent."

**[VISUAL]** Show example with details:
> "For example: Closet Door Frame (Metal) has 12 readings—5 positive, 7 negative. That's 41.7% positive."

**[VISUAL]** Click View Details
> "Unlike other categories, you can click 'View Details' to see exactly which locations tested positive. This is crucial for targeted remediation."

**[VISUAL]** Show individual readings
> "The report shows each reading's location, room, and result. This tells you exactly where the lead paint is."

---

### Scene 8: Reading the Stats Cards (5:15 - 5:45)

**[VISUAL]** Zoom in on stats cards at top

**[NARRATION]**
> "At the top of your report, you'll see summary statistics:"

**[VISUAL]** Highlight each card:
> "**Total Readings**: All readings in this dataset.
>
> **Positive**: Total positive readings with percentage.
>
> **Negative**: Total negative readings.
>
> **Unique Combinations**: Number of component/substrate pairs analyzed."

---

### Scene 9: Exporting Reports (5:45 - 6:15)

**[VISUAL]** Click Export All to Excel

**[NARRATION]**
> "Need to share or archive your reports? Click **Export All to Excel**."

**[VISUAL]** Show Excel file opening
> "This creates a multi-sheet Excel workbook with:
> - Average Components summary
> - Uniform Components summary  
> - Non-Uniform Components with all details"

> "Each sheet has separate columns for Component and Substrate for easy filtering and analysis."

---

### Scene 10: Wrap Up (6:15 - 6:45)

**[VISUAL]** Return to summary view

**[NARRATION]**
> "Understanding these HUD/EPA classifications is essential for lead paint compliance. Remember:
> - 40+ readings: Use the 2.5% statistical rule
> - Under 40, all same: Uniform classification
> - Under 40, mixed: Non-Uniform—check each location
>
> The XRF Processor handles all these calculations automatically, so you can focus on remediation and compliance."

**[VISUAL]** End card

---

## Key Points to Emphasize

1. Lead positive threshold: 1.0 mg/cm²
2. The 40-reading threshold determines classification method
3. 2.5% rule applies to Average Components only
4. Non-Uniform components require location-specific review
5. Component AND Substrate are considered together

## Demo Data Needed

- File with mix of all three categories:
  - At least one component with 40+ readings
  - Several uniform components (all positive or all negative)
  - At least one non-uniform component with mixed results
