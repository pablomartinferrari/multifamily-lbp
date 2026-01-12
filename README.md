# XRF Lead Paint Processor

A SharePoint Framework (SPFx) web part for processing XRF lead paint inspection data with AI-powered component normalization and HUD/EPA compliant reporting.

![SharePoint Framework](https://img.shields.io/badge/SPFx-1.20.0-green.svg)
![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)

## 🎯 Overview

The XRF Lead Paint Processor helps property managers and lead paint inspectors:

- **Process XRF Inspection Data** - Upload Excel (.xlsx) or CSV files from XRF devices
- **AI-Powered Normalization** - Automatically standardize component and substrate names using OpenAI/Azure OpenAI
- **HUD/EPA Compliant Reports** - Generate summaries following federal guidelines (40-reading threshold, 2.5% rule)
- **SharePoint Integration** - Store all data securely in SharePoint lists with full audit trail

## ✨ Features

### Core Functionality
- 📤 **File Upload** - Drag-and-drop Excel/CSV files with automatic column detection
- 🤖 **AI Normalization** - Intelligent grouping of component variants (e.g., "dr jamb" → "Door Jamb")
- 📊 **Smart Grouping** - Aggregates readings by Component + Substrate combinations
- 📋 **Three Summary Categories**:
  - **Average Components** (≥40 readings) - Statistical 2.5% threshold
  - **Uniform Components** (<40 readings, all same result)
  - **Non-Uniform Components** (<40 readings, mixed results)

### Data Management
- ✏️ **Inline Editing** - Edit readings directly in the data grid
- 📝 **Bulk Edit** - Change multiple readings at once
- 🔄 **Merge/Replace** - Add new data to existing jobs or replace entirely
- 📥 **Load Existing Data** - Retrieve previously uploaded data without re-uploading

### Export & Reporting
- 📑 **Excel Export** - Multi-sheet workbooks with all summary categories
- 📄 **CSV Export** - Simple format for external tools
- 🔍 **All Shots Report** - Searchable list of every individual reading

### Help & Support
- ✨ **AI Help Assistant** - Built-in chatbot for instant help (powered by OpenAI)
- 📚 **Comprehensive Documentation** - Architecture, implementation guides, and tutorials

## 🏗️ Architecture

```
multifamily-lbp/
├── xrf-processor/           # SPFx Web Part
│   ├── src/
│   │   └── webparts/
│   │       └── xrfProcessor/
│   │           ├── components/     # React UI components
│   │           ├── services/       # Business logic services
│   │           ├── models/         # TypeScript interfaces
│   │           ├── config/         # Configuration & prompts
│   │           └── constants/      # SharePoint list names
│   └── config/              # SPFx build configuration
├── scripts/
│   └── sharepoint/          # PowerShell setup scripts
└── docs/
    ├── ARCHITECTURE.md      # System architecture
    ├── REQUIREMENTS.md      # Business requirements
    ├── IMPLEMENTATION.md    # Technical implementation
    ├── plan/                # Build block plans
    └── tutorials/           # Video script tutorials
```

### Key Services

| Service | Description |
|---------|-------------|
| `ExcelParserService` | Parses Excel/CSV files, detects columns, extracts readings |
| `ComponentNormalizerService` | AI-powered component name standardization with caching |
| `SubstrateNormalizerService` | AI-powered substrate name standardization with caching |
| `SummaryService` | HUD/EPA compliant classification and aggregation |
| `SharePointService` | CRUD operations for all SharePoint lists |
| `OpenAIService` | OpenAI/Azure OpenAI API integration |

## 📋 Prerequisites

- **Node.js** 18.17.1 (required for SPFx 1.20)
- **SharePoint Online** tenant with app catalog
- **OpenAI API Key** or **Azure OpenAI** deployment
- **PowerShell 7+** (for setup scripts)
- **PnP PowerShell** module

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/multifamily-lbp.git
cd multifamily-lbp
```

### 2. Set Up SharePoint Lists

```powershell
cd scripts/sharepoint

# Copy and configure settings
cp config.example.ps1 config.ps1
# Edit config.ps1 with your SharePoint URL and credentials

# Run setup
./Setup-SharePointLibraries.ps1
```

This creates the required SharePoint lists:
- `XRF-SourceFiles` - Uploaded inspection files
- `XRF-Readings` - Processed reading data
- `XRF-ProcessingJobs` - Job metadata and status
- `XRF-ComponentCache` - Cached component normalizations
- `XRF-SubstrateCache` - Cached substrate normalizations

### 3. Install Dependencies

```bash
cd xrf-processor
npm install
```

### 4. Configure the Web Part

Edit `src/webparts/xrfProcessor/XrfProcessorWebPart.ts` or configure via property pane:

```typescript
// OpenAI Configuration
provider: "openai" | "azure"
apiKey: "your-api-key"
model: "gpt-4o-mini"  // or Azure deployment name

// Azure OpenAI (if using Azure)
azureEndpoint: "https://your-resource.openai.azure.com"
azureApiVersion: "2024-02-15-preview"
```

### 5. Run Locally

```bash
gulp serve
```

Open the SharePoint workbench and add the web part.

### 6. Build for Production

```bash
gulp bundle --ship
gulp package-solution --ship
```

Deploy `sharepoint/solution/xrf-processor.sppkg` to your app catalog.

## ⚙️ Configuration

### OpenAI Setup

The web part supports both standard OpenAI and Azure OpenAI:

**Standard OpenAI:**
```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o-mini",
  "temperature": 0.3,
  "maxTokens": 2000
}
```

**Azure OpenAI:**
```json
{
  "provider": "azure",
  "apiKey": "your-azure-key",
  "model": "your-deployment-name",
  "azureEndpoint": "https://your-resource.openai.azure.com",
  "azureApiVersion": "2024-02-15-preview"
}
```

### SharePoint Lists

All list names are defined in `src/webparts/xrfProcessor/constants/LibraryNames.ts`:

```typescript
export const LIBRARIES = {
  SOURCE_FILES: "XRF-SourceFiles",
  READINGS: "XRF-Readings",
  PROCESSING_JOBS: "XRF-ProcessingJobs",
  COMPONENT_CACHE: "XRF-ComponentCache",
  SUBSTRATE_CACHE: "XRF-SubstrateCache",
};
```

## 📖 Usage

### Basic Workflow

1. **Upload File** - Select Excel/CSV file, enter Job Number and Area Type
2. **AI Processing** - System normalizes component and substrate names
3. **Review Data** - Check readings, make edits if needed
4. **Generate Summary** - Create HUD/EPA compliant report
5. **Export** - Download Excel/CSV for records

### HUD/EPA Classification Rules

| Category | Criteria | Result Determination |
|----------|----------|---------------------|
| **Average** | ≥40 readings | POSITIVE if >2.5% positive |
| **Uniform** | <40 readings, all same | Result matches all readings |
| **Non-Uniform** | <40 readings, mixed | Requires individual review |

### Lead Content Threshold

- **Positive**: ≥ 1.0 mg/cm²
- **Negative**: < 1.0 mg/cm²

## 🧪 Testing

```bash
cd xrf-processor

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=SummaryService

# Watch mode
npm run test:watch
```

### Test Coverage

- `ExcelParserService` - File parsing, CSV support, column detection
- `SummaryService` - HUD/EPA classification logic
- `ComponentNormalizerService` - AI normalization with caching
- `SubstrateNormalizerService` - Substrate normalization
- `OpenAIService` - API integration

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and component overview |
| [REQUIREMENTS.md](docs/REQUIREMENTS.md) | Business requirements and specifications |
| [IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | Technical implementation details |
| [Tutorials](docs/tutorials/) | Video script tutorials for end users |
| [Build Plans](docs/plan/) | Step-by-step implementation plans |

## 🔧 Development

### Project Structure

```
xrf-processor/src/webparts/xrfProcessor/
├── components/
│   ├── XrfProcessor.tsx          # Main orchestrator
│   ├── FileUpload/               # File upload UI
│   ├── DataReviewGrid/           # Reading editor
│   ├── ResultsSummary/           # Summary display
│   ├── AllShotsReport/           # All readings list
│   ├── AINormalizationReview/    # Normalization review
│   ├── UploadConflictDialog/     # Merge/Replace dialog
│   └── HelpChatPanel/            # AI help assistant
├── services/
│   ├── ExcelParserService.ts     # File parsing
│   ├── SharePointService.ts      # SharePoint CRUD
│   ├── SummaryService.ts         # HUD/EPA logic
│   ├── ComponentNormalizerService.ts
│   ├── SubstrateNormalizerService.ts
│   └── OpenAIService.ts          # AI integration
├── models/                        # TypeScript interfaces
├── config/                        # OpenAI prompts, help context
└── constants/                     # SharePoint list names
```

### Adding New Features

1. Create service in `services/` with corresponding `.test.ts`
2. Add models in `models/`
3. Create UI component in `components/`
4. Wire up in `XrfProcessor.tsx`
5. Update documentation

### Code Style

- TypeScript strict mode
- ESLint with SPFx rules
- Fluent UI React components
- Jest for testing

## 📦 Deployment

### App Catalog Deployment

1. Build the package:
   ```bash
   gulp bundle --ship
   gulp package-solution --ship
   ```

2. Upload `sharepoint/solution/xrf-processor.sppkg` to your tenant app catalog

3. Deploy to all sites or specific sites

4. Add the web part to your SharePoint page

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | Jan 2026 | Substrate normalization, CSV support, AI help assistant |
| 1.1.0 | Dec 2025 | Component normalization, caching, merge/replace |
| 1.0.0 | Nov 2025 | Initial release |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

**THIS CODE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE, MERCHANTABILITY, OR NON-INFRINGEMENT.**

This tool is designed to assist with lead paint inspection data processing but does not replace professional judgment. Always verify results and consult with qualified professionals for lead paint compliance decisions.

## 🙏 Acknowledgments

- [SharePoint Framework](https://docs.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview)
- [PnP/PnPjs](https://pnp.github.io/pnpjs/)
- [Fluent UI React](https://developer.microsoft.com/en-us/fluentui)
- [SheetJS](https://sheetjs.com/) for Excel/CSV parsing
- [OpenAI](https://openai.com/) for AI normalization

---

<p align="center">
  Made with ❤️ for lead paint safety
</p>
