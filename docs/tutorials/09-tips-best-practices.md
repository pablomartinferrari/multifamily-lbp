# Tutorial 9: Tips and Best Practices

**Duration:** 4-5 minutes  
**Target Audience:** Power users  
**Prerequisites:** Familiarity with basic XRF Processor features

---

## Script

### Scene 1: Introduction (0:00 - 0:20)

**[VISUAL]** Show montage of app features

**[NARRATION]**
> "Now that you know the basics of the XRF Lead Paint Processor, let's cover some tips and best practices that will make you a power user. These insights come from real-world usage and will help you work more efficiently."

---

### Scene 2: Data Preparation Tips (0:20 - 1:15)

**[VISUAL]** Show Excel file being prepared

**[NARRATION]**
> "The best results start with good data. Here are tips for preparing your files:"

**[VISUAL]** Tip 1 - Column Names
> "**Use consistent column names**. While the system can detect variations like 'PbC' or 'Lead Content', using standard names like 'Component', 'Substrate', and 'Lead Content' ensures smooth parsing."

**[VISUAL]** Tip 2 - Include Substrate
> "**Always include substrate data**. The system groups by component AND substrate, so 'Door Frame on Wood' and 'Door Frame on Metal' are tracked separately. This gives you more accurate location data for remediation."

**[VISUAL]** Tip 3 - Use Reading IDs
> "**Include unique Reading IDs**. If your XRF device generates reading identifiers, include them. This helps with data tracking and allows proper merging when you add data later."

**[VISUAL]** Tip 4 - First Sheet
> "**Put data on the first sheet**. For Excel files, the processor reads the first worksheet. Make sure your data is there, not hidden in another tab."

---

### Scene 3: Normalization Best Practices (1:15 - 2:00)

**[VISUAL]** Show AI normalization panel

**[NARRATION]**
> "AI normalization is powerful, but you can help it work even better:"

**[VISUAL]** Tip 1 - Review First Run
> "**Review carefully on first upload**. The first time you process a property type, review the normalizations closely. These mappings get cached, so getting them right the first time saves work later."

**[VISUAL]** Tip 2 - Consistent Input
> "**Be reasonably consistent**. While AI handles variations, using consistent naming in your input reduces ambiguity. If your inspectors can agree on abbreviations, even better."

**[VISUAL]** Tip 3 - Check Unusual Names
> "**Watch for unusual components**. If your building has unique features—maybe antique fixtures or custom millwork—check that these normalize correctly."

---

### Scene 4: Workflow Efficiency (2:00 - 2:45)

**[VISUAL]** Show workflow steps

**[NARRATION]**
> "Here are some tips for an efficient workflow:"

**[VISUAL]** Tip 1 - Batch Similar Jobs
> "**Process similar properties together**. If you're inspecting multiple similar buildings, the cached normalizations from the first one will speed up all subsequent uploads."

**[VISUAL]** Tip 2 - Use Merge
> "**Use Merge for multi-day inspections**. If an inspection spans multiple days, upload each day's file separately and merge. This keeps your data organized while building a complete dataset."

**[VISUAL]** Tip 3 - Export Regularly
> "**Export after each session**. Get in the habit of exporting your data and summaries. This creates an archive and gives you files for your records."

---

### Scene 5: Understanding Your Data (2:45 - 3:30)

**[VISUAL]** Show summary report

**[NARRATION]**
> "Some tips for interpreting your results:"

**[VISUAL]** Tip 1 - Focus on Non-Uniform
> "**Pay special attention to Non-Uniform components**. These have mixed results and require location-specific remediation. Use the 'View Details' feature to see exactly where lead paint was found."

**[VISUAL]** Tip 2 - Check Unique Combinations Count
> "**Monitor unique combinations count**. If this number seems too high, you might have inconsistent naming that AI couldn't fully resolve. Consider bulk editing to consolidate."

**[VISUAL]** Tip 3 - Verify Thresholds
> "**Understand the 40-reading boundary**. If a component has 39 readings and needs to be classified as Average, consider whether you can take one more reading. This isn't always possible or necessary, but it's worth knowing."

---

### Scene 6: Troubleshooting Common Issues (3:30 - 4:15)

**[VISUAL]** Show troubleshooting tips

**[NARRATION]**
> "If you run into issues, try these solutions:"

**[VISUAL]** Issue 1
> "**'No readings found'** - Check that your Excel file has data on the first sheet and includes Component and Lead Content columns."

**[VISUAL]** Issue 2
> "**Slow processing** - Large files with many unique component names take longer because of AI normalization. This gets faster with caching."

**[VISUAL]** Issue 3
> "**Unexpected normalizations** - If AI grouped things incorrectly, use bulk edit to fix them. The corrections won't be cached automatically, so make a note for future uploads."

**[VISUAL]** Issue 4
> "**Missing substrate** - If substrate is missing from your source file, readings won't be grouped by material. Add substrate data to your source if possible."

---

### Scene 7: Security and Compliance (4:15 - 4:45)

**[VISUAL]** Show security icons

**[NARRATION]**
> "A few notes on security and compliance:"

**[VISUAL]** Tip 1
> "**All data stays in SharePoint**. Your inspection data is stored in your organization's SharePoint, protected by your existing security policies."

**[VISUAL]** Tip 2
> "**AI processes only names**. The AI normalization only sees component and substrate names—not your lead content values, locations, or other sensitive data."

**[VISUAL]** Tip 3
> "**Export for official records**. While SharePoint storage is reliable, export official copies of your compliance reports for your records management system."

---

### Scene 8: Wrap Up (4:45 - 5:00)

**[VISUAL]** Show app home screen

**[NARRATION]**
> "Those are our top tips for getting the most out of the XRF Lead Paint Processor. With these best practices, you'll process inspections faster, more accurately, and with full HUD/EPA compliance.
>
> Thanks for watching this tutorial series. If you have questions, remember—the AI Help Assistant is just a click away!"

**[VISUAL]** End card with series recap

---

## Key Points to Emphasize

1. Good data preparation leads to better results
2. Review normalizations carefully on first upload
3. Use merge for multi-day or multi-file inspections
4. Focus on Non-Uniform components for remediation
5. Export regularly for backup and records

## Demo Data Needed

- Well-prepared sample file for comparison
- File with intentional issues for troubleshooting demo
- Multiple files for merge demonstration
