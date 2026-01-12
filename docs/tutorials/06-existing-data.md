# Tutorial 6: Working with Existing Data

**Duration:** 3-4 minutes  
**Target Audience:** Returning users  
**Prerequisites:** Previously uploaded data in the system

---

## Script

### Scene 1: Introduction (0:00 - 0:20)

**[VISUAL]** Show the Process File tab

**[NARRATION]**
> "What if you've already uploaded data for a job and need to access it again? Or what if you want to add more readings to an existing dataset? This video covers working with existing data."

---

### Scene 2: Loading Existing Data (0:20 - 1:15)

**[VISUAL]** Show the Job Number and Area Type fields

**[NARRATION]**
> "Let's say you processed a file last week and need to generate a new report or review the data. You don't need to upload the file again."

**[VISUAL]** Enter job number
> "Simply enter the **Job Number** for the existing job..."

**[VISUAL]** Select area type
> "...and select the **Area Type**."

**[VISUAL]** Highlight the "Load Existing Data" button
> "Notice the **Load Existing Data** button appears. This shows up when you have a job number but haven't selected a file to upload."

**[VISUAL]** Click the button
> "Click it, and the system retrieves your previously uploaded data from SharePoint."

**[VISUAL]** Show data loading
> "The original file is fetched, re-parsed, and normalizations are applied—just like a fresh upload, but without needing the file on your computer."

**[VISUAL]** Show completed data grid
> "And there's your data, ready for review or report generation."

---

### Scene 3: Merging New Data (1:15 - 2:15)

**[VISUAL]** Show file upload with existing job number

**[NARRATION]**
> "Now let's say you have additional inspection data for the same job. Maybe you inspected more units and want to add those readings."

**[VISUAL]** Enter same job number and area type
> "Enter the same Job Number and Area Type..."

**[VISUAL]** Select new file
> "...then select your new file with the additional readings."

**[VISUAL]** Click Process File
> "Click **Process File**..."

**[VISUAL]** Show conflict dialog
> "The system detects existing data and shows you this dialog. Here's where you decide what to do."

**[VISUAL]** Highlight Merge option (already selected)
> "**Merge** is the default option—and usually what you want. It combines your new readings with the existing ones."

**[VISUAL]** Show what merge does:
- New readings are added
- Duplicate Reading IDs are updated with new values
- Existing unique readings are preserved

> "Merging is smart: if a reading has the same ID, it updates that reading. Otherwise, it adds the new reading to your dataset."

---

### Scene 4: Replacing Data (2:15 - 2:45)

**[VISUAL]** Highlight Replace option

**[NARRATION]**
> "Sometimes you want to start fresh. Maybe the first file had errors, or you're completely re-doing the inspection."

**[VISUAL]** Select Replace option
> "Choose **Replace** to delete all existing readings and use only the new file."

**[VISUAL]** Show warning icon
> "Be careful with this option—the old data will be removed. You can always re-upload the original file if needed, but any edits you made will be lost."

---

### Scene 5: Checking What's There (2:45 - 3:15)

**[VISUAL]** Show the existing file info in conflict dialog

**[NARRATION]**
> "The conflict dialog gives you helpful information about the existing data."

**[VISUAL]** Highlight each info item:
> "You can see:
> - The original filename
> - When it was uploaded
> - Total readings in the system
> - How many are positive
> - Current status
>
> Use this to make an informed decision about merging or replacing."

---

### Scene 6: Wrap Up (3:15 - 3:45)

**[VISUAL]** Show completed merge

**[NARRATION]**
> "Working with existing data is seamless. Use **Load Existing Data** when you just need to revisit previous work. Use **Merge** when you're adding to a dataset. Use **Replace** when you need a fresh start.
>
> All your data is safely stored in SharePoint, so you can always access it when you need it."

**[VISUAL]** End card

---

## Key Points to Emphasize

1. Load Existing Data retrieves previously uploaded files
2. Merge is the default and recommended for adding data
3. Replace removes all existing data
4. Conflict dialog shows details about existing data
5. All data is stored in SharePoint for safekeeping

## Demo Data Needed

- Previously uploaded job with 100+ readings
- Second file with additional readings for same job
- Some overlapping Reading IDs to demonstrate update behavior
