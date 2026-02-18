# SOW Workbench v2.4.0

A comprehensive Statement of Work management tool for Antenna Group. Draft new SOWs from client call transcripts or review existing SOWs against agency quality standards.

## What's New in v2.4.0

### Client FIT Archetype Integration
The SOW Workbench now integrates with Antenna Group's FIT (Framework for Intelligent Tailoring) assessment to personalize service recommendations and SOW tone:

- **Four archetypes**: Architect (📐 Strategic & Systematic), Visionary (✨ Creative & Bold), Accelerator (📊 Performance & Data-Driven), Entrepreneur (🚀 Fast & Action-Oriented)
- **Blend support**: Select up to 2 archetypes per client for blended profiles
- **Service boosting**: Archetype selection automatically recommends additional services aligned with the client's working style
- **FIT badges**: Services boosted by archetype selection are marked with a "FIT" tag in the service list
- **SOW tone guidance**: Selected archetypes inject specific language and framing guidance into SOW generation (e.g., Architects get strategic methodology language, Entrepreneurs get sprint-based delivery language)
- **Dynamic re-evaluation**: Changing archetypes after transcript analysis automatically adds relevant services without removing manual selections

## What's New in v2.3.3

### Estimated Pricing Range Total
A live total now appears above the Generate SOW button showing the combined budget range for all selected services:
- Sums low and high ranges across all checked services
- Handles bundled services correctly (counts bundle price once, not per service)
- Notes when Project Management (~10%) would be additional
- Flags when some services require custom scoping for pricing
- Updates in real time as services are checked/unchecked

## What's New in v2.3.2

### SOW Review: Pricing Validation
When reviewing an existing SOW, the system now cross-checks pricing against guide ranges:
- **Underpriced**: Flags services priced below the guide range (risk: undervaluing work)
- **Overpriced**: Flags services priced above the guide range (risk: client pushback)
- **In Range**: Confirms pricing falls within expected range
- **Missing PM**: Alerts if Project Management fee is missing on non-PR engagements

## What's New in v2.3.1

### Guide Pricing Integration
All services now include pricing guidance visible when selected:
- **Term estimates**: Duration in weeks for project-based work
- **Budget ranges**: Low-high pricing guidance 
- **Bundle indicators**: Shows when services are bundled together
- **Special notes**: Context like "Annual retainer" or "Excludes venue costs"

### Service Bundles
Services that are typically sold together are now visually grouped:
- Standard Website Offering (Strategy, Design, Development, CMS)
- Brand Strategy bundle (Research, IDIs, Discovery, Positioning, etc.)
- Creative Retainer (all creative production services)
- Standard PR (Media Relations + Press Kit)
- And many more...

### Project Management Guidance
- Shows "~10% of project" pricing
- Notes that PM is not required on PR/Earned-only engagements

## What's New in v2.3.0

### Integrated Engagement Type
New engagement type for complex multi-phase engagements:
- Automatically detects when multiple billing models are needed
- Structures SOW with distinct sections (Fixed Fee, Retainer, T&M)
- Provides section-specific terms and fee structures
- Smart recommendation system suggests Integrated when appropriate

### Billing Model Analysis
System now analyzes selected services to determine optimal engagement structure:
- Fixed Fee preferred: Website, Brand, Events, GTM, Training, Impact, Measurement
- Retainer preferred: PR, Executive Visibility, Paid Social, SEO, GEO, Performance Marketing
- Time & Materials preferred: Creative Production, Content Production
- Automatically recommends Integrated when services span multiple models

## What's New in v2.0.0

### Enhanced Semantic Trigger Detection
The AI now uses sophisticated semantic analysis to identify client needs, not just keyword matching. It understands:
- **Pain points**: Problems expressed through frustration, complaints, challenges
- **Ambitions**: Goals expressed through "we want to", "our goal is", aspirational language
- **Situational triggers**: Business events like mergers, launches, new leadership, funding
- **Performance gaps**: Declining metrics, competitive losses, ROI questions
- **Resource constraints**: Team capacity issues, expertise gaps, time pressure

### Expanded Service Categories (23 categories)
Now includes comprehensive coverage of all agency service lines:
- Website & App Development
- Integrated Marketing Strategy
- Brand Strategy & Identity
- Creative Production
- Influencer Marketing
- Creative Campaigns & Platforms
- Public Relations
- Media Outreach (Proactive & Reactive)
- Executive Visibility & Thought Leadership
- Paid Social Media
- SEO
- Generative Engine Optimization (GEO)
- Measurement & Analytics
- Go-to-Market Strategy
- Event Planning & Production
- Communications Training
- Impact Report Writing & Design
- Content Ideation & Production
- Performance Marketing & Optimization
- Brand & Marketing Assessments
- Plus enhanced versions of original categories

### Comprehensive SOW Assessment Framework
The review engine now checks against a much more detailed framework including:
- All 12 essential SOW components with specific requirements
- Language quality standards with 25+ red flag patterns
- Contract-type specific requirements (Fixed Fee, T&M, T&M with Cap, Retainer)
- Service-line specific checklists
- Scope creep prevention mechanisms
- Detailed acceptance criteria and client responsibility patterns

### Trigger Intensity Detection
AI now identifies urgency level:
- **High Intensity**: Board priorities, revenue impact, competitive threats, hard deadlines
- **Medium Intensity**: Roadmap items, exploration mode, planning phase
- **Low Intensity**: Curiosity, future consideration

### Combined Trigger Pattern Recognition
Recognizes common service combinations:
- Launch scenarios → GTM, PR, creative, paid social, website
- Brand transformation → brand strategy, website, creative, integrated
- Growth mode → SEO, performance marketing, content, measurement
- Awareness building → PR, media outreach, executive visibility, content

## Features

### Draft Mode (Create New SOWs)
- Paste client call transcripts for AI analysis
- Automatic extraction of: success criteria, problem statements, mandatories, timeline, budget signals, stakeholders, context
- Smart service category recommendations based on semantic analysis
- Customizable service selection with expandable categories
- Complete SOW generation following Antenna Group standards
- Engagement-type specific guidance (Fixed Fee, T&M, T&M with Cap, Retainer)
- Download as branded Word document

### Review Mode (Assess Existing SOWs)
- Upload PDF, DOCX, or text files
- Comprehensive assessment against quality framework
- Categorized feedback: Critical Issues, Recommended Improvements, Red Flags
- Service-line compliance checking
- Budget verification
- Generate revised drafts incorporating all fixes
- Download revised versions as Word documents

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Claude API (Anthropic) - Sonnet 4
- docx library for Word document generation

## Local Development

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd sow-reviewer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

## Deployment to Vercel

See DEPLOYMENT.md for step-by-step instructions.

## Usage

### Drafting a New SOW
1. Enter your Anthropic API key
2. Select engagement type (Fixed Fee, T&M, T&M with Cap, or Retainer)
3. Add any notes from the account team (optional)
4. Paste the client call transcript
5. Click "Analyze Transcript"
6. Review detected service categories and adjust selections as needed
7. Click "Generate SOW Draft"
8. Download the Word document

### Reviewing an Existing SOW
1. Enter your Anthropic API key
2. Upload your SOW document (PDF, DOCX, or TXT)
3. Select the engagement type
4. Click "Analyze SOW"
5. Review the structured feedback
6. Optionally generate a revised draft
7. Download the revised Word document

## Assessment Framework Overview

### Universal Requirements (All SOWs)
- Decimal numbering structure (1.1, 1.1.1, etc.)
- Explicit completion criteria for each deliverable
- Controlled language (no vague qualifiers)
- Deliverable structure (activities, outputs, assumptions)
- Client responsibilities with consequences
- Master assumptions with contingencies
- Explicit scope exclusions
- Change management process

### Contract-Type Requirements

**Fixed Fee**
- Exhaustive scope definition
- Revision limits
- Strong assumptions section
- Change order process
- Deemed acceptance provisions

**Time & Materials**
- Complete rate schedule
- Initial estimate (not cap)
- Notification thresholds
- Reporting requirements

**T&M with Cap**
- Cap tied to scope
- Work stoppage rights
- Cap adjustment mechanisms
- Assumption protection

**Retainer**
- Minimum term
- Hour/deliverable allocation
- Rollover policy
- Overage handling
- Utilization reporting

### Service-Line Specific
- **Branding**: Phase gates, concept counts, brand components, file formats
- **Website**: Technical specs, content responsibility, browser compatibility, warranty
- **PR/Comms**: Pitch quantities, media lists, reporting cadence, crisis exclusions
- **Creative Retainer**: Hour allocation, rollover, SLAs, rate card
- **Integrated**: Workstream dependencies, coordination, single accountability

## Red Flag Language Patterns

The tool flags and suggests replacements for:
- "As needed" → bounded quantities with "up to"
- "Ongoing" → defined term limits
- "Reasonable" → specific definitions
- "Unlimited" → capped quantities
- "Best efforts" → measurable criteria
- "Various" → enumerated items
- "Regular" → specified frequency
- And 15+ more patterns

## Version History

### v2.4.0 (Current)
- **Client FIT Archetype Integration** - Tailor service recommendations and SOW tone based on client's working style archetype (Architect, Visionary, Accelerator, Entrepreneur)
- **Blend support** - Select up to 2 archetypes for blended client profiles
- **Dynamic service boosting** - Archetype selection auto-recommends aligned services with "FIT" badges
- **SOW generation guidance** - Archetype-specific language and framing injected into AI prompt

### v2.3.4
- **Bundle Selection UI** - Bundles appear as top-level checkboxes that auto-select all included services
- **Live Pricing Total** - Real-time budget range with PM percentage breakdown
- **Content Production pricing** - Added $60K–$180K annual range for content bundles
- **PM line item** - Project Management now shows calculated 10% amount in pricing total
- **Integrated Engagement Type** - New billing model for multi-phase engagements that span Fixed Fee, Retainer, and T&M services
- **Auto-detection of billing models** - System analyzes selected services and recommends Integrated when multiple billing models are needed
- **Multi-section SOW generation** - Integrated SOWs automatically structure into separate sections:
  - Section A: Fixed Fee (Brand, Website, Events, Strategy, Campaigns, GTM, Training, Impact, Measurement)
  - Section B: Retainer (PR, Executive Visibility, Paid Social, SEO, GEO, Performance Marketing, Influencer)
  - Section C: Time & Materials (Creative Production, Content Production)
- **Smart engagement type selection** - Engagement type auto-sets based on detected services, including Integrated when needed
- **Reorganized engagement type buttons** - Now ordered: Fixed Fee, Retainer, T&M, Integrated, T&M with Cap

### v2.2.3
- Fixed service auto-selection after transcript analysis
- Added more robust category extraction from AI responses
- Added debugging console logs for troubleshooting
- Auto-set engagement type now works correctly

### v2.2.2
- Removed condition hints from UI (cleaner display)
- Fixed auto-selection to only pre-check 'always' recommend services

### v2.2.1
- **Comprehensive service consolidation** across all 19 categories
- All services now have recommendation logic with conditions for when to recommend
- **Removed duplicate services** across categories:
  - Media Training consolidated (removed from Exec Visibility, kept in PR & Training)
  - Media Relations consolidated (removed from Exec Visibility, kept in PR)
  - Crisis Preparedness merged with Crisis Communications in PR
  - Manifesto Writing removed from Impact (already in Brand)
  - Technical SEO items merged
- **Service categories streamlined:**
  - Influencer: 8 → 5 services
  - Executive Visibility: 13 → 7 services
  - Paid Social: 8 → 6 services
  - SEO: 10 → 7 services
  - GEO: 6 → 4 services
  - Measurement: 8 → 6 services
  - GTM: 8 → 5 services
  - Events: 8 → 6 services
  - Training: 6 → 4 services
  - Impact: 12 → 6 services
  - Performance Marketing: 11 → 6 services
  - Project Management: 6 → 4 services
- **Each service now has:**
  - `recommend`: 'always' or 'conditional'
  - `condition`: guidance text for when to recommend

### v2.2.0
- **Major streamlining of service categories** from 31 to 19 categories
- Each category now has explicit `engagementType` property for clearer recommendations
- Categories merged/consolidated:
  - Media Outreach → Public Relations & Media Outreach
  - Executive & Leadership → Executive Visibility & Thought Leadership
  - Creative & Innovation → Creative Campaigns & Innovation
  - Impact Reports → Impact & Purpose Communications
  - Removed: awareness, reputation, influence, audience, messaging, content, leads, creative, leadership, marketing_assessment (consolidated into other categories)
- Updated Brand Strategy & Expression with new structure:
  - Strategy: Research, Stakeholder Interviews (IDIs), Rapid Discovery, Positioning, Brand House, Brand Workshop, Authentic Foundation
  - Expression: Tone of Voice, Manifesto, Visual Identity System, Logo/Wordmark Development
  - Assets: Brand Deck, Social Lock-ups, Brand Guidelines
- Creative Production now includes Content Ideation and Transcreation (Multi-language)
- Content Ideation & Production now includes Reactive and Proactive Content
- Performance Marketing now includes Measurement & Reporting across Owned, Earned, Paid, and Social
- SEO now includes Technical SEO Audit (moved from Website)
- Marketing Audit & Assessment renamed to Marketing Audit & Assessment (Compass)
- Project Management marked as 'any' engagement type (can be applied to any engagement)

### v2.1.9
- Added engagement type validation and recommendations based on selected services
- System now suggests appropriate engagement types:
  - **Fixed Fee**: Website/app production, branding, events, ring-fenced campaigns, upfront strategy
  - **T&M**: Creative/integrated work where deliverables evolve (with minimum spend, monthly planning)
  - **Retainer**: PR, media outreach, thought leadership, social media
  - **T&M with Cap**: Only when specifically requested by client (shows warning)
- Visual indicator when engagement type doesn't match services (with one-click switch)
- Enhanced SOW generation with proper budget/billing language per engagement type:
  - Fixed Fee: Milestone-based payments, total project fee presentation
  - T&M: Minimum commitment language (not "drawdown"), monthly planning sessions
  - Retainer: Monthly fee in advance, utilization reporting, rollover policies
  - T&M Cap: Cap presentation, notification thresholds, work stoppage language

### v2.1.8
- AI no longer invents budget numbers in recommendations
- Uses "$xxxx.xx" placeholder for unspecified amounts
- Known Antenna Group minimums are used when applicable:
  - Branding Strategy & Expression: $50,000 minimum
  - Creative T&M retainer deposit: $24,000 minimum  
  - Brand assessment: $4,000
  - Minimum retainers: $15,000
- If SOW contains specific values, those are used in recommendations

### v2.1.7
- Added guidance for deposit-based minimum commitment retainers vs traditional hourly allocation retainers
- AI now correctly understands that "minimum commitment held as deposit" is a FLOOR, not a ceiling
- AI will not incorrectly suggest "up to" language for deposit amounts
- AI will not incorrectly suggest rollover policies for deposit-based retainers
- Updated Creative Retainers and Retainer Contracts sections in assessment framework
- Added explicit rule in review prompt to handle deposit-based retainer language correctly

### v2.1.6
- Word documents now use proper Word numbering instead of text-based numbers
- Multi-level decimal numbering (1., 1.1, 1.1.1, etc.) uses native Word list styles
- Numbering is editable in Word - add/remove items and numbers update automatically
- Bullet lists also use native Word bullet styles
- Improved SOW content parsing to detect numbering levels accurately
- [REVISED] and [NEW] markers styled as italic gray annotations

### v2.1.5
- Added checkboxes to each recommendation (Critical, Recommended, Red Flags)
- All recommendations selected by default (opt-out model)
- Added "Select All / Deselect All" toggle for each section
- Selection summary shown in Generate Revised SOW panel
- Generate Draft button disabled when no recommendations selected
- Deselected items appear faded/grayed out
- Only selected recommendations are passed to SOW generation

### v2.1.4
- Renamed "Service-Line Compliance" to "Structural Compliance"

### v2.1.3
- Fixed section parsing to handle markdown formatting (##, **, etc.)
- parseSection now accepts multiple possible header formats
- IssueCard now strips markdown bold markers before parsing
- Improved regex patterns for Current/Recommended extraction
- Fixed duplicate code issue in IssueCard component
- Section headers like "## CRITICAL ISSUES" now correctly detected

### v2.1.1
- Fixed issue where "missing element" recommendations were showing unrelated "Current" text
- AI now distinguishes between two types of issues:
  - **Language Issues**: Existing text that needs improvement (shows Current → Recommended)
  - **Missing Elements**: Required sections that don't exist (shows "Add This Language" only)
- Updated IssueCard component to render both issue types appropriately
- Improved prompt clarity for SOW review output formatting

### v2.1.0
- Enhanced semantic trigger detection with 5 trigger types per service category
- Added performance triggers for metrics-based need detection
- Added trigger intensity detection (High/Medium/Low urgency)
- Improved AI prompts for better semantic matching
- Added version number display on homepage

### v2.0.0
- Enhanced semantic trigger detection
- 23 service categories with detailed trigger patterns
- Comprehensive SOW assessment framework
- Engagement-type specific guidance
- Combined trigger pattern recognition

### v1.0.0
- Initial release
- Basic SOW review functionality
- Simple trigger matching
- Word document generation

## License

Internal use only - Antenna Group
