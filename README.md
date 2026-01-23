# SOW Review Tool

A Statement of Work quality assessment tool for Antenna Group. Upload an SOW document and get automated feedback based on the agency's quality standards framework.

## Features

- **Document Support**: Upload PDF, DOCX, or plain text SOW documents
- **Engagement Types**: Specialized assessment for Branding, Website, PR/Communications, Creative Retainer, and Integrated engagements
- **Comprehensive Analysis**: Checks universal requirements, client responsibilities, master assumptions, service-line specifics, and budget alignment
- **Actionable Feedback**: Critical issues, recommended improvements, red flags, and overall compliance scoring

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Claude API (Anthropic)

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

1. Enter your Anthropic API key (get one at https://console.anthropic.com)
2. Upload your SOW document (PDF, DOCX, or TXT)
3. Select the engagement type
4. Click "Analyze SOW"
5. Review the structured feedback

## Assessment Framework

The tool checks SOWs against the following criteria:

### Universal Requirements
- Decimal numbering structure
- Completion criteria for each deliverable
- Controlled language (no red flag phrases)
- Deliverable structure (activities, outputs, assumptions)
- Client responsibilities (consolidated feedback, approval windows, change control)
- Master assumptions (scope boundaries, revision limits, pause/termination)
- Explicit scope exclusions
- Budget alignment

### Service-Line Specific
- **Branding**: Phase gates, IDI counts, creative territories, brand components
- **Website**: BRD, page counts, platform, UAT, warranty, hosting
- **PR/Comms**: Retainer structure, rate card, reporting cadence, media disclaimers
- **Creative Retainer**: Drawdown, request parameters, SLAs, exclusions
- **Integrated**: Fee structure separation, timeline visualization, quarterly planning

## License

Internal use only - Antenna Group
