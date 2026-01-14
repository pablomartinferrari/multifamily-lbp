# Tutorial 2: Uploading Your First File

**Duration:** 4-5 minutes  
**Target Audience:** New users  
**Prerequisites:** XRF inspection data in Excel or CSV format

---

## Script

### Scene 1: Introduction (0:00 - 0:20)

**[VISUAL]** App home screen with "Process File" tab visible

**[NARRATION]**
> "In this tutorial, we'll walk through uploading your first XRF inspection file. By the end, you'll have your data loaded and ready for processing."

---

### Scene 2: Preparing Your File (0:20 - 1:00)

**[VISUAL]** Show an Excel file with inspection data

**[NARRATION]**
> "Before we begin, let's make sure your file is ready. The XRF Processor works with Excel (.xlsx) and CSV (.csv) files.
>
> Your file should include these key columns:"

**[VISUAL]** Highlight columns in Excel:
- Component (required)
- Lead Content or PbC (required)
- Substrate (recommended)
- Location
- Room
- Reading ID
- Color

**[NARRATION]**
> "The most important columns are **Component** and **Lead Content**. The system will find these automatically, even if they have slightly different names like 'PbC' or 'Lead mg/cm²'.
>
> If you have substrate information—that's the surface material like wood or metal—include that too. It helps with more accurate grouping."

---

### Scene 3: Starting the Upload (1:00 - 1:45)

**[VISUAL]** Navigate to Process File tab

**[NARRATION]**
> "Now let's upload. Make sure you're on the 'Process File' tab."

**[VISUAL]** Click on Job Number field
> "First, enter your **Job Number**. This is your project identifier—use whatever system your organization follows."

**[VISUAL]** Type "JOB-2024-001"
> "I'll enter 'JOB-2024-001' for this example."

**[VISUAL]** Click on Area Type dropdown
> "Next, select your **Area Type**. Choose 'Units' if this data is from individual apartments, or 'Common Areas' for hallways, lobbies, and shared spaces."

**[VISUAL]** Select "Units"
> "I'll select 'Units' since our sample data is from apartment inspections."

---

### Scene 4: Selecting Your File (1:45 - 2:30)

**[VISUAL]** Click the upload area

**[NARRATION]**
> "Now click the upload area or drag your file directly onto it."

**[VISUAL]** Select file from file picker
> "I'll select my inspection file... and there it is. You can see the filename appears, confirming the file is selected."

**[VISUAL]** Show file info displayed
> "The system shows you the file name and size. Make sure this is the correct file before proceeding."

**[VISUAL]** Highlight the "Process File" button
> "When you're ready, click the **Process File** button."

---

### Scene 5: The Processing Steps (2:30 - 3:30)

**[VISUAL]** Click Process File, show progress bar

**[NARRATION]**
> "Watch the progress bar as the system works. Let me explain what's happening at each step:"

**[VISUAL]** Progress shows "Uploading..."
> "First, your file is uploaded to SharePoint for safekeeping."

**[VISUAL]** Progress shows "Parsing..."
> "Then the system parses your Excel file, extracting all the readings."

**[VISUAL]** Progress shows "Normalizing components..."
> "Next comes AI normalization. The system is analyzing your component names and standardizing them."

**[VISUAL]** Progress shows "Normalizing substrates..."
> "It does the same for substrate names."

**[VISUAL]** Progress shows "Saving..."
> "Finally, everything is saved to SharePoint."

**[VISUAL]** Show completion with reading count
> "Done! You can see we've imported 247 readings from this file."

---

### Scene 6: What's Next (3:30 - 4:00)

**[VISUAL]** Show the data review grid appearing

**[NARRATION]**
> "After processing, you'll see your data in the review grid. From here, you can:
> - Review all your readings
> - Check the AI normalizations
> - Make any necessary edits
> - Generate your compliance summary
>
> We'll cover data review in detail in the next video."

---

### Scene 7: Handling Existing Data (4:00 - 4:30)

**[VISUAL]** Show the conflict dialog

**[NARRATION]**
> "One more thing—if you upload a file for a job and area that already has data, you'll see this dialog."

**[VISUAL]** Highlight the two options
> "You can choose to **Merge** the new data with existing readings—this is the default and recommended option. Or you can **Replace** to start fresh.
>
> Merging is useful when you're adding additional inspection data to a job."

---

### Scene 8: Wrap Up (4:30 - 4:45)

**[VISUAL]** Return to completed state

**[NARRATION]**
> "That's how you upload your first file! In the next video, we'll explore how the AI normalization works and why it's so valuable for your workflow."

**[VISUAL]** End card

---

## Key Points to Emphasize

1. Required columns: Component and Lead Content
2. Include Substrate for better grouping
3. Job Number and Area Type are required
4. Merge is the default option for existing data

## Demo Data Needed

- Sample Excel file with 200-300 readings
- Mix of component name variations (e.g., "door jamb", "dr jamb", "Door Jamb")
- Include substrate data
