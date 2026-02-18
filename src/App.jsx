import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, AlertCircle, Loader2, ChevronDown, ChevronRight, Key, Eye, EyeOff, ArrowUpRight, Copy, Check, ArrowRight, Download, Sparkles, PenTool, Search, MessageSquare, Lightbulb, Target, Users, ChevronLeft, DollarSign, Save, FolderOpen } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak, LevelFormat, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

// ============================================================================
// VERSION
// ============================================================================
const APP_VERSION = '2.7.0';

// ============================================================================
// DOCX GENERATION UTILITIES
// ============================================================================

// Antenna Group logo as base64 (simple text fallback for header)
const createAntennaHeader = () => {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: ".antenna",
            font: "Arial",
            size: 36,
            bold: true,
          }),
          new TextRun({
            text: "group",
            font: "Arial",
            size: 24,
            color: "666666",
          }),
        ],
      }),
    ],
  });
};

const createFooter = () => {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Page ",
            font: "Arial",
            size: 20,
            color: "666666",
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: "Arial",
            size: 20,
            color: "666666",
          }),
        ],
      }),
    ],
  });
};

// Parse SOW text into structured sections with proper level detection
const parseSOWContent = (sowText) => {
  const lines = sowText.split('\n');
  const sections = [];
  let currentSection = null;
  
  // Helper to detect numbering level from text like "1.", "1.1", "1.1.1", "1.1.1.1"
  const getNumberingLevel = (text) => {
    // Match patterns like "1.", "1.1", "1.1.1", "A.", "a.", etc.
    const decimalMatch = text.match(/^(\d+(?:\.\d+)*)\.\s/);
    if (decimalMatch) {
      const parts = decimalMatch[1].split('.');
      return { level: parts.length - 1, number: decimalMatch[0], text: text.replace(decimalMatch[0], '').trim() };
    }
    const simpleMatch = text.match(/^(\d+)\.\s/);
    if (simpleMatch) {
      return { level: 0, number: simpleMatch[0], text: text.replace(simpleMatch[0], '').trim() };
    }
    const letterMatch = text.match(/^([a-zA-Z])\.\s/);
    if (letterMatch) {
      return { level: 3, number: letterMatch[0], text: text.replace(letterMatch[0], '').trim() };
    }
    const romanMatch = text.match(/^(i{1,3}|iv|vi{0,3}|ix|x)\.\s/i);
    if (romanMatch) {
      return { level: 4, number: romanMatch[0], text: text.replace(romanMatch[0], '').trim() };
    }
    return null;
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check for markdown headings (# or ##)
    if (trimmed.startsWith('# ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: 'h1', text: trimmed.replace(/^#+\s*/, ''), children: [] };
    } else if (trimmed.startsWith('## ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: 'h2', text: trimmed.replace(/^#+\s*/, ''), children: [] };
    } else if (trimmed.startsWith('### ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: 'h3', text: trimmed.replace(/^#+\s*/, ''), children: [] };
    } else {
      // Check for decimal numbering
      const numbering = getNumberingLevel(trimmed);
      if (numbering) {
        if (numbering.level === 0) {
          // Top level (1., 2., etc.) - new section
          if (currentSection) sections.push(currentSection);
          currentSection = { 
            type: 'numbered', 
            level: 0, 
            numberText: numbering.number,
            text: numbering.text, 
            fullText: trimmed,
            children: [] 
          };
        } else {
          // Sub-levels (1.1, 1.1.1, etc.)
          if (currentSection) {
            currentSection.children.push({ 
              type: 'numbered', 
              level: numbering.level,
              numberText: numbering.number,
              text: numbering.text,
              fullText: trimmed
            });
          } else {
            sections.push({ 
              type: 'numbered', 
              level: numbering.level,
              numberText: numbering.number,
              text: numbering.text, 
              fullText: trimmed,
              children: [] 
            });
          }
        }
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        // Bullet point
        if (currentSection) {
          currentSection.children.push({ type: 'bullet', text: trimmed.replace(/^[-•]\s*/, '') });
        } else {
          sections.push({ type: 'bullet', text: trimmed.replace(/^[-•]\s*/, ''), children: [] });
        }
      } else if (trimmed.startsWith('[REVISED]') || trimmed.startsWith('[NEW]')) {
        // Revision markers - treat as annotation
        if (currentSection) {
          currentSection.children.push({ type: 'marker', text: trimmed });
        } else {
          sections.push({ type: 'marker', text: trimmed, children: [] });
        }
      } else {
        // Regular paragraph
        if (currentSection) {
          currentSection.children.push({ type: 'para', text: trimmed });
        } else {
          sections.push({ type: 'para', text: trimmed, children: [] });
        }
      }
    }
  }
  
  if (currentSection) sections.push(currentSection);
  return sections;
};

// Generate Word document from SOW content with proper numbering
const generateSOWDocument = async (sowText, projectInfo = {}) => {
  const sections = parseSOWContent(sowText);
  const children = [];
  
  // Title
  const title = projectInfo.title || 'Statement of Work (SOW)';
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 56,
          font: "Arial",
        }),
      ],
      spacing: { after: 400 },
    })
  );
  
  // Version and date info
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "VERSION: ", bold: true, size: 22, font: "Arial" }),
        new TextRun({ text: "1.0", size: 22, font: "Arial" }),
      ],
      spacing: { after: 100 },
    })
  );
  
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "DATE: ", bold: true, size: 22, font: "Arial" }),
        new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 22, font: "Arial" }),
      ],
      spacing: { after: 100 },
    })
  );
  
  if (projectInfo.client) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "PREPARED FOR: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: projectInfo.client, size: 22, font: "Arial" }),
        ],
        spacing: { after: 100 },
      })
    );
  }
  
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "CREATED BY: ", bold: true, size: 22, font: "Arial" }),
        new TextRun({ text: "Antenna Group", size: 22, font: "Arial" }),
      ],
      spacing: { after: 400 },
    })
  );
  
  // Add horizontal line
  children.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
      },
      spacing: { after: 400 },
    })
  );
  
  // Helper to get indent for numbering level
  const getIndentForLevel = (level) => {
    const baseIndent = 360; // 0.25 inch in twips
    return { left: baseIndent * (level + 1), hanging: 360 };
  };
  
  // Helper to get font size for level
  const getFontSizeForLevel = (level) => {
    if (level === 0) return 26; // 13pt
    if (level === 1) return 24; // 12pt
    return 22; // 11pt
  };
  
  // Process each section
  for (const section of sections) {
    if (section.type === 'h1') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({
              text: section.text,
              bold: true,
              size: 32,
              font: "Arial",
            }),
          ],
          spacing: { before: 400, after: 200 },
        })
      );
    } else if (section.type === 'h2') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: section.text,
              bold: true,
              size: 28,
              font: "Arial",
            }),
          ],
          spacing: { before: 300, after: 150 },
        })
      );
    } else if (section.type === 'h3') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [
            new TextRun({
              text: section.text,
              bold: true,
              size: 24,
              font: "Arial",
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (section.type === 'numbered') {
      // Use Word's numbering for top-level numbered items
      const level = section.level || 0;
      children.push(
        new Paragraph({
          numbering: {
            reference: "sow-numbering",
            level: level,
          },
          children: [
            new TextRun({
              text: section.text,
              bold: level === 0,
              size: getFontSizeForLevel(level),
              font: "Arial",
            }),
          ],
          spacing: { before: level === 0 ? 300 : 150, after: 150 },
        })
      );
    } else if (section.type === 'marker') {
      // [REVISED] or [NEW] markers
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.text,
              italics: true,
              size: 20,
              font: "Arial",
              color: "666666",
            }),
          ],
          spacing: { after: 100 },
        })
      );
    } else if (section.type === 'para') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.text,
              size: 22,
              font: "Arial",
            }),
          ],
          spacing: { after: 150 },
        })
      );
    }
    
    // Process children
    for (const child of section.children || []) {
      if (child.type === 'numbered') {
        // Sub-numbered items use Word's multi-level numbering
        const level = child.level || 1;
        children.push(
          new Paragraph({
            numbering: {
              reference: "sow-numbering",
              level: level,
            },
            children: [
              new TextRun({
                text: child.text,
                bold: level <= 1,
                size: getFontSizeForLevel(level),
                font: "Arial",
              }),
            ],
            spacing: { before: 100, after: 100 },
          })
        );
      } else if (child.type === 'bullet') {
        children.push(
          new Paragraph({
            numbering: {
              reference: "bullet-list",
              level: 0,
            },
            children: [
              new TextRun({
                text: child.text,
                size: 22,
                font: "Arial",
              }),
            ],
            spacing: { after: 80 },
          })
        );
      } else if (child.type === 'marker') {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: child.text,
                italics: true,
                size: 20,
                font: "Arial",
                color: "666666",
              }),
            ],
            indent: { left: 360 },
            spacing: { after: 100 },
          })
        );
      } else if (child.type === 'para' || child.type === 'sub') {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: child.text || child.fullText,
                size: 22,
                font: "Arial",
              }),
            ],
            indent: { left: 360 },
            spacing: { after: 100 },
          })
        );
      }
    }
  }
  
  // Create document with proper numbering definitions
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "sow-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 360, hanging: 360 },
                },
                run: { bold: true, size: 26 },
              },
            },
            {
              level: 1,
              format: LevelFormat.DECIMAL,
              text: "%1.%2",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
                run: { bold: true, size: 24 },
              },
            },
            {
              level: 2,
              format: LevelFormat.DECIMAL,
              text: "%1.%2.%3",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 1080, hanging: 540 },
                },
                run: { size: 22 },
              },
            },
            {
              level: 3,
              format: LevelFormat.LOWER_LETTER,
              text: "%4.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 1440, hanging: 360 },
                },
                run: { size: 22 },
              },
            },
            {
              level: 4,
              format: LevelFormat.LOWER_ROMAN,
              text: "%5.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 1800, hanging: 360 },
                },
                run: { size: 22 },
              },
            },
          ],
        },
        {
          reference: "bullet-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "○",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 1080, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 22,
          },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 400, after: 200 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 300, after: 150 } },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: {
            width: 12240,
            height: 15840,
          },
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      headers: {
        default: createAntennaHeader(),
      },
      footers: {
        default: createFooter(),
      },
      children: children,
    }],
  });
  
  return doc;
};

// Download as Word document
const downloadAsDocx = async (sowText, filename, projectInfo = {}) => {
  try {
    const doc = await generateSOWDocument(sowText, projectInfo);
    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error generating DOCX:', error);
    // Fallback to text download
    const textBlob = new Blob([sowText], { type: 'text/plain' });
    saveAs(textBlob, filename.replace('.docx', '.txt'));
  }
};

// ============================================================================
// SERVICE TRIGGER MAPPINGS (Streamlined 19 categories)
// ============================================================================
// === SYNC:SERVICE_TRIGGERS_START ===
const SERVICE_TRIGGERS = [
  {
    id: 'website',
    category: 'Website & App Development',
    description: 'Build or rebuild digital platforms',
    engagementType: 'fixed_fee',
    services: [
      // Standard Website Offering bundle
      { name: 'Website Strategy & Planning', recommend: 'always', condition: 'when website is mentioned', pricing: { termLow: 8, termHigh: 20, budgetLow: 40000, budgetHigh: 140000, bundle: 'Standard Website Offering' } },
      { name: 'Website Design & UX', recommend: 'always', condition: 'when website is mentioned', pricing: { bundle: 'Standard Website Offering' } },
      { name: 'Website Development', recommend: 'always', condition: 'when website is mentioned', pricing: { bundle: 'Standard Website Offering' } },
      { name: 'CMS Implementation', recommend: 'always', condition: 'when website is mentioned', pricing: { bundle: 'Standard Website Offering' } },
      { name: 'Performance Assurance', recommend: 'always', condition: 'when website is mentioned', pricing: { bundle: 'Standard Website Offering' } },
      // Individual services
      { name: 'Website Refresh', recommend: 'conditional', condition: 'Staying on existing CMS but a simple design refresh without any updates to brand or website structure. This includes enhancements to fonts, color, image selection and data visualization only. Shoudl only be offered when client is stuck on existing CMS and only needs styling updates.', pricing: { termLow: 5, termHigh: 8, budgetLow: 20000, budgetHigh: 30000 } },
      { name: 'Mobile App Development', recommend: 'conditional', condition: 'only if standalone app is requested. Goo to recopmmend for events, campaigns or launch moments.', pricing: { termLow: 3, termHigh: 10, budgetLow: 10000, budgetHigh: 60000 } },
      { name: 'Landing Page Development', recommend: 'conditional', condition: 'only if landing or holding page is referenced. Good for temprary websites. Single page fixed structure', pricing: { termLow: 1, termHigh: 3, budgetLow: 10000, budgetHigh: 15000 } },
      { name: 'Website Migration', recommend: 'conditional', condition: 'only if content migration is referenced as requirement', pricing: { termLow: 1, termHigh: 4, budgetLow: 10000, budgetHigh: 60000 } },
      { name: 'Performance Optimization and Support', recommend: 'conditional', condition: 'only if website reporting and tracking is referenced as requirement', pricing: { termLow: 52, termHigh: 52, budgetLow: 24000, budgetHigh: 30000, note: 'Annual retainer' } },
    ],
    triggerPatterns: {
      direct: ['need a new website', 'website redesign', 'site looks outdated', 'rebuild our site', 'new landing page', 'mobile-friendly'],
      indirect: ['high bounce rates', 'site is slow', 'can\'t update the site ourselves', 'CMS is difficult', 'doesn\'t reflect our brand', 'can\'t integrate with our tools'],
      situational: ['recent rebrand', 'merger', 'new product launch', 'expansion into new markets', 'adding e-commerce', 'company milestone'],
      performance: ['low conversion rates', 'cart abandonment', 'poor search rankings', 'low time on site', 'customer complaints about UX', 'website not generating leads'],
      sampleLanguage: ['people leave our site within seconds', 'can\'t compete with competitors\' sites', 'developer left and we can\'t make changes', 'looks fine on desktop but terrible on mobile', 'doesn\'t show up in Google', 'customers can\'t find what they\'re looking for', 'outgrown our platform', 'website doesn\'t tell our story']
    }
  },
  {
    id: 'integrated_strategy',
    category: 'Integrated Marketing Strategy',
    description: 'Develop cohesive marketing plans',
    engagementType: 'fixed_fee',
    services: [
      { name: 'Marketing Strategy Development', recommend: 'conditional', condition: 'when client has specific marketing goals (awareness, reputation, credibility, visibility, perception, audience inspiration)', pricing: { termLow: 1, termHigh: 4, budgetLow: 10000, budgetHigh: 25000 } },
      { name: 'Channel Planning & Media Mix & Connections Planning', recommend: 'conditional', condition: 'when paid and social media are discussed as requirements', pricing: { termLow: 1, termHigh: 3, budgetLow: 10000, budgetHigh: 20000 } },
      { name: 'Primary audience research', recommend: 'conditional', condition: 'This should be delivered by a consultants and will require hard cost fees. For surveys focus groups. TO gather qualitiative insight', pricing: { termLow: 4, termHigh: 6, budgetLow: 25000, budgetHigh: 35000 } },
      { name: 'Customer Journey Mapping', recommend: 'conditional', condition: 'when website conversion is a goal or audience segmentation issues identified', pricing: { termLow: 1, termHigh: 2, budgetLow: 7000, budgetHigh: 15000 } },
      { name: 'Marketing Audit & Assessment (Compass)', recommend: 'conditional', condition: 'when client does not know what problem to solve or has broad goals (awareness, reputation, credibility, visibility, perception)', pricing: { termLow: 1, termHigh: 2, budgetLow: 3000, budgetHigh: 4000 } },
      { name: 'Market & Competitive Research', recommend: 'conditional', condition: 'when client does not know competitors or requests differentiation', pricing: { termLow: 1, termHigh: 2, budgetLow: 2000, budgetHigh: 30000 } },
      { name: 'Audience Research & Segmentation', recommend: 'conditional', condition: 'when client does not know their audience, what inspires them, or how to reach them', pricing: { termLow: 1, termHigh: 2, budgetLow: 2000, budgetHigh: 5000 } },
    ],
    triggerPatterns: {
      direct: ['need a marketing strategy', 'marketing feels disjointed', 'don\'t have a plan', 'where to focus our budget', 'nothing seems connected'],
      indirect: ['marketing not producing results', 'conflicting messages', 'no customer journey', 'which channels to prioritize', 'marketing and sales not aligned', 'budget spread too thin'],
      situational: ['new fiscal year', 'leadership change', 'entering new market', 'product launch', 'competitive pressure', 'organizational shift'],
      performance: ['declining market share', 'acquisition costs increasing', 'ROI unknown', 'lead quality issues', 'lifetime value decreasing', 'inconsistent channel performance'],
      sampleLanguage: ['throwing spaghetti at the wall', 'don\'t know what\'s working', 'competitors seem to be everywhere', 'marketing and sales blame each other', 'never had a real strategy', 'channels aren\'t talking to each other', 'someone to make sense of all this', 'reactive instead of proactive']
    }
  },
  {
    id: 'brand',
    category: 'Brand Strategy & Expression',
    description: 'Define or refresh your brand foundation',
    engagementType: 'fixed_fee',
    services: [
      // Brand Strategy bundle
      { name: 'Brand Research (Compass)', recommend: 'always', condition: 'for all brand refresh projects', pricing: { termLow: 2, termHigh: 4, budgetLow: 15000, budgetHigh: 20000, bundle: 'Brand Strategy' } },
      { name: 'Stakeholder Interviews (IDIs)', recommend: 'always', condition: 'for all brand projects', pricing: { bundle: 'Brand Strategy' } },
      { name: 'Rapid Discovery (Landscape & Audience)', recommend: 'always', condition: 'for all brand projects', pricing: { bundle: 'Brand Strategy' } },
      { name: 'Brand Positioning', recommend: 'always', condition: 'for all brand projects', pricing: { bundle: 'Brand Strategy' } },
      { name: 'Brand House Development', recommend: 'always', condition: 'for all brand projects', pricing: { bundle: 'Brand Strategy' } },
      { name: 'Brand Workshop', recommend: 'always', condition: 'for all brand projects', pricing: { bundle: 'Brand Strategy' } },
      { name: 'Authentic Foundation (Why, What, How)', recommend: 'always', condition: 'for all brand projects', pricing: { bundle: 'Brand Strategy' } },
      // Brand Expression bundle
      { name: 'Tone of Voice', recommend: 'always', condition: 'for all brand projects', pricing: { termLow: 3, termHigh: 7, budgetLow: 25000, budgetHigh: 30000, bundle: 'Brand Expression' } },
      { name: 'Manifesto', recommend: 'always', condition: 'for all brand projects', pricing: { bundle: 'Brand Expression' } },
      { name: 'Visual Identity System', recommend: 'always', condition: 'for all brand projects', pricing: { bundle: 'Brand Expression' } },
      { name: 'Logo/Wordmark Development', recommend: 'always', condition: 'for all brand projects', pricing: { bundle: 'Brand Expression' } },
      { name: 'Brand Deck Asset Production', recommend: 'conditional', condition: 'only if requested', pricing: { termLow: 1, termHigh: 4, budgetLow: 10000, budgetHigh: 30000, bundle: 'Brand Expression' } },
      // Brand Assets bundle
      { name: 'Social Lock-ups', recommend: 'conditional', condition: 'only if requested', pricing: { termLow: 1, termHigh: 2, budgetLow: 10000, budgetHigh: 15000, bundle: 'Brand Assets' } },
      { name: 'Brand Guidelines', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Brand Assets' } },
    ],
    triggerPatterns: {
      direct: ['need to rebrand', 'brand feels outdated', 'need a new logo', 'brand doesn\'t reflect who we are', 'need brand guidelines', 'brand is inconsistent'],
      indirect: ['company evolved but identity hasn\'t', 'can\'t explain what makes us different', 'inconsistent messaging', 'employees can\'t articulate positioning', 'customer confusion', 'premium pricing not supported by perception'],
      situational: ['merger or acquisition', 'spin-off', 'new leadership', 'expansion beyond original scope', 'new markets', 'negative reputation', 'company milestone', 'IPO'],
      performance: ['brand awareness declining', 'NPS dropping', 'customer feedback about perception', 'can\'t command premium prices', 'losing deals to stronger brands', 'employee engagement declining'],
      sampleLanguage: ['nobody knows who we are', 'look just like everyone else', 'brand worked when we were small but we\'ve grown', 'customers don\'t understand our value', 'visual identity all over the place', 'embarrassed to hand out business cards', 'can\'t attract talent', 'different departments use different logos', 'evolved but brand hasn\'t', 'associated with something we don\'t do anymore', 'launching in new markets']
    }
  },
  {
    id: 'creative_production',
    category: 'Creative Production',
    description: 'Design, video, animation, and content creation',
    engagementType: 'tm',
    services: [
      // Creative Retainer bundle
      { name: 'Graphic Design', recommend: 'conditional', condition: 'only if requested', pricing: { termLow: 52, termHigh: 52, budgetLow: 24000, budgetHigh: 80000, bundle: 'Creative Retainer', note: 'Annual minimum commitment' } },
      { name: 'Video Production', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Creative Retainer' } },
      { name: 'Animation & Motion Graphics', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Creative Retainer' } },
      { name: 'Photography', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Creative Retainer' } },
      { name: 'Copywriting', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Creative Retainer' } },
      { name: 'Sales Collateral', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Creative Retainer' } },
      { name: 'Presentation Design', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Creative Retainer' } },
      { name: 'Social Media Content', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Creative Retainer' } },
      { name: 'Campaign Asset Creation', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Creative Retainer' } },
      { name: 'Brand Asset Library', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Creative Retainer' } },
      { name: 'Content Ideation', recommend: 'conditional', condition: 'only if requested', pricing: { bundle: 'Creative Retainer' } },
      { name: 'Transcreation (Multi-language)', recommend: 'conditional', condition: 'only if requested or translation/multi-language is mentioned', pricing: { bundle: 'Creative Retainer' } },
    ],
    triggerPatterns: {
      direct: ['need a brochure', 'need a video', 'don\'t have creative resources', 'need professional design', 'materials look amateurish', 'need campaign assets'],
      indirect: ['marketing team stretched thin', 'quality inconsistent', 'no in-house design', 'need specialized formats', 'high volume of creative needs', 'tight deadlines'],
      situational: ['campaign launch', 'trade show', 'sales team needs collateral', 'product launch', 'seasonal campaign', 'executive presentations'],
      performance: ['creative not generating engagement', 'sales team not using materials', 'A/B tests showing underperformance', 'feedback that materials aren\'t compelling', 'social engagement below benchmarks'],
      sampleLanguage: ['don\'t have designers on staff', 'team is overwhelmed', 'need a video but don\'t know where to start', 'sales deck needs updating', 'need assets for our campaign', 'everything takes too long to produce', 'competitors\' materials look more polished', 'have the strategy but need help executing']
    }
  },
  {
    id: 'influencer',
    category: 'Influencer Marketing',
    description: 'Leverage creator partnerships',
    engagementType: 'retainer',
    services: [
      // Influencer Retainer bundle
      { name: 'Influencer Strategy', recommend: 'always', condition: 'when influencer marketing is discussed', pricing: { termLow: 52, termHigh: 52, budgetLow: 30000, budgetHigh: 100000, bundle: 'Influencer Retainer', note: 'Annual retainer, excludes creator fees' } },
      { name: 'Creator Identification & Vetting', recommend: 'always', condition: 'when influencer marketing is discussed', pricing: { bundle: 'Influencer Retainer' } },
      { name: 'Influencer Campaign Management', recommend: 'always', condition: 'when influencer marketing is discussed', pricing: { bundle: 'Influencer Retainer' } },
      { name: 'Ambassador Programs', recommend: 'conditional', condition: 'only if long-term creator partnerships are requested', pricing: { bundle: 'Influencer Retainer' } },
      { name: 'UGC Programs', recommend: 'conditional', condition: 'only if user-generated content is requested', pricing: { bundle: 'Influencer Retainer' } },
    ],
    triggerPatterns: {
      direct: ['want to work with influencers', 'need an influencer campaign', 'reach audience through creators', 'tried influencer marketing but it didn\'t work'],
      indirect: ['difficulty reaching younger audiences', 'need authentic endorsements', 'product requires demonstration', 'brand awareness stalled', 'user-generated content insufficient'],
      situational: ['product launch needing buzz', 'new demographic market', 'brand relevance concerns', 'competitors using influencers', 'need authentic content at scale', 'event amplification'],
      performance: ['social engagement declining', 'owned content not resonating', 'advertising fatigue', 'high CPA on paid channels', 'brand trust declining'],
      sampleLanguage: ['can\'t break through on social', 'younger audiences don\'t trust us directly', 'competitors partnering with creators', 'need authentic voices', 'tried on our own but didn\'t see results', 'don\'t know how to find the right creators', 'need content that feels genuine', 'want to be part of the conversation on TikTok']
    }
  },
  {
    id: 'creative_campaigns',
    category: 'Creative Campaigns & Innovation',
    description: 'Develop breakthrough campaign concepts',
    engagementType: 'fixed_fee',
    services: [
      // Creative Campaigns bundle
      { name: 'Creative Platform Development', recommend: 'conditional', condition: 'when there is a request for a campaign or content series for owned, earned, paid, and/or social', pricing: { termLow: 2, termHigh: 7, budgetLow: 18000, budgetHigh: 30000, bundle: 'Creative Campaigns' } },
      { name: 'Big Idea Generation', recommend: 'conditional', condition: 'when client wants to make a splash, generate awareness, inspire media attention, or connect with audience', pricing: { bundle: 'Creative Campaigns' } },
      { name: 'Experiential Concepts', recommend: 'conditional', condition: 'when big idea development, media stunt, or event production are being recommended or requested', pricing: { bundle: 'Creative Campaigns' } },
    ],
    triggerPatterns: {
      direct: ['need a big idea', 'need a campaign concept', 'want something breakthrough', 'need a creative platform', 'marketing lacks unifying concept', 'marketing is uninspiring', 'breakthrough ideas'],
      indirect: ['campaigns feel tactical', 'each effort is standalone', 'difficulty creating memorable work', 'need to differentiate', 'brand awareness plateaued', 'work is boring', 'looks like everyone else'],
      situational: ['major launch', 'brand repositioning', 'new market entry', 'competitive threat', 'company transformation', 'major anniversary', 'category disruption'],
      performance: ['brand recall declining', 'campaign metrics mediocre', 'share of voice decreasing', 'advertising not breaking through', 'content engagement low', 'creative fatigue'],
      sampleLanguage: ['need something memorable', 'all our campaigns look the same', 'want to stand out', 'need an idea that can run for years', 'work doesn\'t break through the clutter', 'want something competitors can\'t copy', 'creative that people talk about', 'ads are forgettable', 'cut through the noise', 'campaigns are safe']
    }
  },
  {
    id: 'pr',
    category: 'Public Relations & Media Outreach',
    description: 'Media relations, press coverage, and ongoing media engagement',
    engagementType: 'retainer',
    services: [
      // Standard PR bundle
      { name: 'Media Relations', recommend: 'always', condition: 'only when client explicitly requests PR, press coverage, earned media, media relations, journalist outreach, or press releases — NOT for general awareness or reputation goals alone', pricing: { termLow: 52, termHigh: 52, budgetLow: 180000, budgetHigh: 360000, bundle: 'Standard PR', note: 'Annual retainer ($15K-$30K/month)' } },
      { name: 'Narrative & Media Messaging', recommend: 'always', condition: 'Low end: $10k – if brand work/IDI’s were done and translating brand into media narrative. High end: $20k – if no brand work was done and we’re building media messaging and narratives from scratch (inclusive of IDIs, workshop, etc.)', pricing: { termLow: 4, termHigh: 6, budgetLow: 10000, budgetHigh: 20000, bundle: 'Standard PR' } },
      // Individual services
      { name: 'Media Training', recommend: 'conditional', condition: 'only when client mentions spokesperson preparation, media interviews, or executive media readiness. Low end: $3k – if training 1 exec, virtual session High end: $10k – if training multiple execs, in-person (does not include travel)', pricing: { termLow: 2, termHigh: 4, budgetLow: 3000, budgetHigh: 10000, note: 'Annual or per session' } },
      // Crises Comms bundle
      { name: 'Crises Plan Development', recommend: 'conditional', condition: 'only if client mentions a crisis, reputational threat, or urgent PR support to solve a pressing and immediate reputation, credibility or perception issue. Fixed-fee project priced off crisis rates Low-end: $15k – if developed to prepare for an identified incident High end: $40k – if developed proactively for various scenarios, inclusive of stakeholder interviews, scenario planning, holding statements, stakeholder matrixes, crisis training, plan roll-out', pricing: { termLow: 1, termHigh: 6, budgetLow: 15000, budgetHigh: 40000, bundle: 'Crises Comms' } },
      { name: 'Crisis Communications', recommend: 'conditional', condition: 'only if client mentions a crisis, reputational threat, or urgent PR support. most of our crisis management work is done on a drawdown basis but should be priced off our crisis flat fee rates vs. standard rate card (crisis rate is higher)', pricing: { termLow: 1, termHigh: 6, budgetLow: 20000, budgetHigh: 100000, bundle: 'Crises Comms', note: 'T&M based on severity' } },
      // Standard PR bundle
      { name: 'Media Monitoring', recommend: 'always', condition: 'only when PR or earned media services are already being recommended, or client specifically requests media monitoring or share of voice tracking. Should always be bundled with Media relations and Narrative & Media Messaging', pricing: { termLow: 52, termHigh: 52, budgetLow: 12000, budgetHigh: 40000, bundle: 'Standard PR', note: 'Annual, excludes tool costs' } },
      { name: 'Earned Media Strategy', recommend: 'conditional', condition: 'This outlines the strategic approach to earned media execution and the plan and is needed if one does not already exist. This is part of the Standard PR bundle and is required wherever a plan or strategy for earned media does not exist.', pricing: { termLow: 2, termHigh: 4, budgetLow: 10000, budgetHigh: 25000, bundle: 'Standard PR', note: 'T&M per opportunity' } },
      // Individual services
      { name: 'Announcement Strategy', recommend: 'conditional', condition: 'Specific targeted comms support to support a corporate announcement. This includes product launch, brand launch, renami, merger, Go To Market, and a high profile leadership announcment.', pricing: { termLow: 1, termHigh: 2, budgetLow: 5000, budgetHigh: 10000 } },
      { name: 'Earned content creation', recommend: 'conditional', condition: 'Blog posts, whitepapers, long form. Based on volume and announcement pipeline. Does not include the coordination of copmplicated releases', pricing: { termLow: 52, termHigh: 52, budgetLow: 12000, budgetHigh: 60000 } },
      { name: 'Onsite media liaison', recommend: 'conditional', condition: 'If the cient mentions that they need on site support from their comms team as a part of an event or a visit. This should only be recomended when requested explicitly.', pricing: { termLow: 0, termHigh: 1, budgetLow: 5000, budgetHigh: 10000 } },
      { name: 'Events and meetings travel', recommend: 'conditional', condition: 'If travel is required this should be 5% of total Public Relations & Media Outreach', pricing: { termLow: 0, termHigh: 0, budgetLow: 5000, budgetHigh: 10000 } },
    ],
    triggerPatterns: {
      direct: ['need PR', 'want media coverage', 'help with press relations', 'want to be in specific publications', 'need a PR agency', 'want to be seen as a source', 'need rapid response', 'earned media', 'press releases', 'media outreach', 'journalist relationships'],
      indirect: ['important news not getting coverage', 'lack of third-party credibility through media', 'competitors in media more', 'no journalist relationships', 'story not being told in the press', 'need crisis preparedness', 'journalists covering competitors but not us'],
      situational: ['funding announcement needing press coverage', 'executive hire needing media announcement', 'research release needing media amplification', 'crisis situation', 'merger announcement needing press strategy'],
      performance: ['low share of voice in media', 'minimal media mentions', 'negative press coverage without response', 'competitors quoted more in media', 'no earned media results'],
      sampleLanguage: ['have great news but nobody covers us', 'competitors always in the press', 'don\'t have relationships with journalists', 'don\'t know how to pitch media', 'need someone to tell our story to the press', 'launching something big and need press coverage', 'not prepared if something goes wrong publicly', 'when something happens in our industry we\'re never quoted', 'want to be top of mind for reporters', 'need earned media']
    }
  },
  {
    id: 'executive_visibility',
    category: 'Executive Visibility & Thought Leadership',
    description: 'Elevate leadership profiles and establish authority',
    engagementType: 'retainer',
    services: [
      // Executive Visibility bundle
      { name: 'Executive Positioning Strategy', recommend: 'always', condition: 'for all executive visibility projects - should be receommended when a c;lient states that they are havining issues with credibility, or are struglgling to get explosure for their leadership acrross tehir industry.', pricing: { termLow: 52, termHigh: 52, budgetLow: 60000, budgetHigh: 180000, bundle: 'Executive Visibility', note: 'Annual retainer ($5K-$15K/month per executive)' } },
      { name: 'Thought Leadership Content', recommend: 'always', condition: 'for all executive visibility projects', pricing: { bundle: 'Executive Visibility' } },
      { name: 'Byline & Op-Ed Development', recommend: 'conditional', condition: 'only when written thought leadership is requested', pricing: { bundle: 'Executive Visibility' } },
      // Individual services
      { name: 'Speaking Opportunity Strategy', recommend: 'conditional', condition: 'only when speaking engagements are requested', pricing: { termLow: 1, termHigh: 3, budgetLow: 5000, budgetHigh: 10000 } },
      { name: 'Onsite Media & Exec Support', recommend: 'conditional', condition: 'only When requested or speaking events are suggested.', pricing: { termLow: 1, termHigh: 1, budgetLow: 5000, budgetHigh: 8000 } },
      { name: 'Executive Social Media Strategy', recommend: 'conditional', condition: 'only when LinkedIn or social presence for company leaders, board or advocates is requested', pricing: { termLow: 1, termHigh: 3, budgetLow: 5000, budgetHigh: 10000 } },
      { name: 'Awards Strategy', recommend: 'conditional', condition: 'only when when recognition programs are requested', pricing: { termLow: 1, termHigh: 1, budgetLow: 5000, budgetHigh: 8000 } },
      { name: 'Podcast Guest Strategy', recommend: 'conditional', condition: 'only when podcast appearances are requested', pricing: { termLow: 1, termHigh: 1, budgetLow: 5000, budgetHigh: 8000 } },
    ],
    triggerPatterns: {
      direct: ['CEO needs to be more visible', 'position executives as experts', 'need thought leadership content', 'leaders need higher profile', 'leadership is invisible', 'ceo profile'],
      indirect: ['competitor executives more visible', 'difficulty attracting talent', 'investor relations need credibility', 'sales cycle requires leadership trust', 'industry influence desired', 'board wants more visible CEO'],
      situational: ['new CEO', 'IPO preparation', 'fundraising', 'conference schedule', 'speaking pipeline', 'award nominations', 'acquisition', 'crisis'],
      performance: ['low leadership recognition', 'executive content not engaging', 'speaking invitations not coming', 'board feedback about visibility', 'LinkedIn engagement low', 'not invited to speak'],
      sampleLanguage: ['CEO should be better known', 'position executive as expert', 'competitors\' leaders always at conferences', 'need help with LinkedIn presence', 'leadership has insights but nobody hears them', 'want execs writing about industry issues', 'need bylines and speaking opportunities', 'investors want visible leadership', 'credibility problem', 'communications is timid']
    }
  },
  {
    id: 'paid_media',
    category: 'Paid Media',
    description: 'Paid Media',
    engagementType: 'fixed_fee',
    services: [
      // Paid Media Strategy bundle
      { name: 'Paid Strategy', recommend: 'always', condition: 'when paid media, acquiring new audiences or extending reach with paid dlars is discussed. This is always presented when there is not yet a strategy to execute a requested paid media campaign.', pricing: { termLow: 2, termHigh: 6, budgetLow: 10000, budgetHigh: 30000, bundle: 'Paid Media Strategy', note: 'Annual retainer, excludes media spend' } },
      // Paid Media Execution bundle
      { name: 'Campaign Setup & Management', recommend: 'conditional', condition: 'when paid media is discussed. This is always required when we are requested to do execution and not just the upfront strategy. This should be presented as a 10% of the paid spend figure quoted by prospect or client. If no paid spend is shared than use the range for this service.', pricing: { termLow: 4, termHigh: 52, budgetLow: 10000, budgetHigh: 100000, bundle: 'Paid Media Execution' } },
      { name: 'Audience Development & Targeting', recommend: 'conditional', condition: 'When client confirms that they either dont know whoe tehir audience is or they have not done any research into where that audience can be reached.', pricing: { termLow: 2, termHigh: 4, budgetLow: 10000, budgetHigh: 20000, bundle: 'Paid Media Execution' } },
      { name: 'Ad Creative Development', recommend: 'conditional', condition: 'Offered as a creative retainer. This is time and material and is offered with a minimum spend of $24k per year', pricing: { termLow: 4, termHigh: 52, budgetLow: 24000, budgetHigh: 60000, bundle: 'Paid Media Execution' } },
      { name: 'Paid Media Reporting', recommend: 'always', condition: 'Offer an economy of scale if reporting for both paid media and scoal media selected. This should present costs as two thirds of teh ranges here fore each when both are selected.', pricing: { termLow: 4, termHigh: 52, budgetLow: 8000, budgetHigh: 60000, bundle: 'Paid Media Execution' } },
    ],
    triggerPatterns: {
      direct: [],
      indirect: [],
      situational: [],
      performance: [],
      sampleLanguage: []
    }
  },
  {
    id: 'social_media',
    category: 'Social Media',
    description: 'Social Media',
    engagementType: 'retainer',
    services: [
      // Social Media Strategy bundle
      { name: 'Social Media Strategy', recommend: 'always', condition: 'when a client or prospect mentions needing social, or if they outline a need to nurture and build audience, or they dontt know what social channels to be on.', pricing: { termLow: 2, termHigh: 6, budgetLow: 15000, budgetHigh: 25000, bundle: 'Social Media Strategy', note: 'Annual retainer, excludes media spend' } },
      { name: 'Channel Planning', recommend: 'always', condition: 'Always alongside the social media strategy to identify which cvhannels to use and how', pricing: { bundle: 'Social Media Strategy' } },
      // Social Execution bundle
      { name: 'Channel Set Up', recommend: 'conditional', condition: 'If they need to set up an optimimze their social channels based upon a clear brand and social strategy. Includes a little creative for profile and hero image and bio.', pricing: { termLow: 1, termHigh: 3, budgetLow: 10000, budgetHigh: 20000, bundle: 'Social Execution' } },
      { name: 'Community Management', recommend: 'conditional', condition: 'If the client wants ongoing management of tehir socisl channels. INcludes engagement, postyinga nd montoring for dverse events.Ongoing management of social communities. This is sold as a monthly cost starting at $4k per month', pricing: { termLow: 4, termHigh: 52, budgetLow: 4000, budgetHigh: 60000, bundle: 'Social Execution' } },
      { name: 'Social creative', recommend: 'conditional', condition: 'For socisl content creation. When content is needed. Offered as a creative retainer. This is time and material and is offered with a minimum spend of $24k per year', pricing: { termLow: 4, termHigh: 52, budgetLow: 24000, budgetHigh: 60000, bundle: 'Social Execution' } },
      { name: 'Social Media Reporting', recommend: 'conditional', condition: 'Offer an economy of scale if reporting for both paid media and scoal media selected. This should present costs as two thirds of the ranges here fore each when both are selected.', pricing: { termLow: 4, termHigh: 52, budgetLow: 8000, budgetHigh: 60000, bundle: 'Social Execution' } },
    ],
    triggerPatterns: {
      direct: [],
      indirect: [],
      situational: [],
      performance: [],
      sampleLanguage: []
    }
  },
  {
    id: 'seo',
    category: 'Search Engine Optimization',
    description: 'Improve organic search visibility',
    engagementType: 'fixed_fee',
    services: [
      // SEO Strategy bundle
      { name: 'SEO Strategy & Audit', recommend: 'always', condition: 'for all SEO engagements or to solve problems with website visibility.', pricing: { termLow: 4, termHigh: 8, budgetLow: 20000, budgetHigh: 35000, bundle: 'SEO Strategy', note: 'Annual retainer ($5K-$10K/month), 6-month minimum' } },
      { name: 'Technical SEO', recommend: 'always', condition: 'for all SEO engagements', pricing: { bundle: 'SEO Strategy' } },
      { name: 'Critical SEO Assessment', recommend: 'conditional', condition: 'If they dont know what SEO statsus is or the problem they need to solve', pricing: { bundle: 'SEO Strategy' } },
      { name: 'Content SEO Strategy', recommend: 'conditional', condition: 'when content marketing is included', pricing: { bundle: 'SEO Strategy' } },
      // SEO Execution bundle
      { name: 'On-Page Optimization', recommend: 'conditional', condition: 'for all SEO engagements', pricing: { termLow: 4, termHigh: 12, budgetLow: 24000, budgetHigh: 60000, bundle: 'SEO Execution' } },
      { name: 'Link Building', recommend: 'conditional', condition: 'when off-page SEO is requested', pricing: { bundle: 'SEO Execution' } },
      { name: 'Local SEO', recommend: 'conditional', condition: 'when local/geographic targeting is needed', pricing: { bundle: 'SEO Execution' } },
      // SEO Reporting bundle
      { name: 'SEO Reporting', recommend: 'conditional', condition: 'for all SEO engagements', pricing: { termLow: 4, termHigh: 52, budgetLow: 4000, budgetHigh: 40000, bundle: 'SEO Reporting' } },
    ],
    triggerPatterns: {
      direct: ['don\'t rank on Google', 'need SEO help', 'organic traffic declining', 'want to rank for keywords'],
      indirect: ['website not appearing in search', 'competitors outranking us', 'paid search costs too high', 'content not getting discovered', 'technical website issues'],
      situational: ['website redesign', 'new content strategy', 'competitive threat in search', 'market expansion', 'algorithm update impact'],
      performance: ['declining organic traffic', 'keyword rankings dropping', 'low domain authority', 'high reliance on paid search', 'competitor visibility increasing'],
      sampleLanguage: ['don\'t show up when people search for what we do', 'competitors always rank above us', 'website redesign and traffic disappeared', 'paying too much for search ads', 'people can\'t find us online', 'content doesn\'t rank', 'don\'t understand SEO', 'hit by a Google update']
    }
  },
  {
    id: 'online_reputation_management_orm',
    category: 'Online Reputation Management (ORM)',
    description: 'Online Reputation Management (ORM)',
    engagementType: 'fixed_fee',
    services: [
      // GEO Strategy bundle
      { name: 'GEO Strategy & Audit', recommend: 'always', condition: 'Where there is a problem or opportunity to shape or improve how a brand appears on LLM  or AI search. Recommend if client is having issues with reputation or perception.', pricing: { termLow: 1, termHigh: 4, budgetLow: 10000, budgetHigh: 20000, bundle: 'GEO Strategy', note: 'Annual retainer, often bundled with SEO' } },
    ],
    triggerPatterns: {
      direct: [],
      indirect: [],
      situational: [],
      performance: [],
      sampleLanguage: []
    }
  },
  {
    id: 'generative_engine_optimization_orm',
    category: 'Generative Engine Optimization (ORM)',
    description: 'Generative Engine Optimization (ORM)',
    engagementType: 'fixed_fee',
    services: [
      // GEO Execution bundle
      { name: 'Reddit Optimization', recommend: 'conditional', condition: 'Reddit Optimization program. If the clientcrequires an improvement to Reddit channel', pricing: { termLow: 4, termHigh: 6, budgetLow: 20000, budgetHigh: 30000, bundle: 'GEO Execution' } },
      { name: 'Wikipedia Optimization', recommend: 'conditional', condition: 'Wikipedia Optimization program. If the client requires an improvement to Wikipedia channel', pricing: { termLow: 3, termHigh: 4, budgetLow: 10000, budgetHigh: 15000, bundle: 'GEO Execution' } },
      { name: 'Earned Strategy for GEO', recommend: 'conditional', condition: 'GEO focused Earned Strategy Enhancement. When we are doing earned and their is a request to limprove visibility, repur=tation and differentiation on LLMs and AI.', pricing: { termLow: 2, termHigh: 4, budgetLow: 10000, budgetHigh: 15000, bundle: 'GEO Execution' } },
    ],
    triggerPatterns: {
      direct: [],
      indirect: [],
      situational: [],
      performance: [],
      sampleLanguage: []
    }
  },
  {
    id: 'integrated_measurement_analytics',
    category: 'Integrated Measurement & Analytics',
    description: 'Integrated Measurement & Analytics',
    engagementType: 'fixed_fee',
    services: [
      // Integrated Measurement Strategy bundle
      { name: 'Analytics Strategy & Measurement Framework', recommend: 'always', condition: 'When there is an integrated program touching any combination of earned, social, web and paid. When selected this supercedes the need for standallone reporting for paid and social', pricing: { termLow: 2, termHigh: 4, budgetLow: 10000, budgetHigh: 20000, bundle: 'Integrated Measurement Strategy' } },
    ],
    triggerPatterns: {
      direct: [],
      indirect: [],
      situational: [],
      performance: [],
      sampleLanguage: []
    }
  },
  {
    id: 'measurement',
    category: 'Measurement & Analytics',
    description: 'Track and prove marketing ROI',
    engagementType: 'fixed_fee',
    services: [
      // Integrated Measurement Strategy bundle
      { name: 'Integrated Dashboard Development', recommend: 'conditional', condition: 'when reporting visualization is requested', pricing: { termLow: 2, termHigh: 4, budgetLow: 10000, budgetHigh: 20000, bundle: 'Integrated Measurement Strategy' } },
      { name: 'Attribution Modeling', recommend: 'conditional', condition: 'when multi-channel attribution is needed', pricing: { termLow: 1, termHigh: 2, budgetLow: 10000, budgetHigh: 20000, bundle: 'Integrated Measurement Strategy' } },
      { name: 'Marketing ROI Framework', recommend: 'conditional', condition: 'for all measurement engagements', pricing: { termLow: 2, termHigh: 3, budgetLow: 10000, budgetHigh: 20000, bundle: 'Integrated Measurement Strategy' } },
      { name: 'KPI Development', recommend: 'conditional', condition: 'for all measurement engagements', pricing: { termLow: 1, termHigh: 2, budgetLow: 10000, budgetHigh: 20000, bundle: 'Integrated Measurement Strategy' } },
      { name: 'Data Integration', recommend: 'conditional', condition: 'when multiple data sources need connecting', pricing: { termLow: 2, termHigh: 4, budgetLow: 20000, budgetHigh: 30000, bundle: 'Integrated Measurement Strategy' } },
      // Integrated Reporting bundle
      { name: 'Reporting', recommend: 'always', condition: 'When there is a need to report on integrated campaign impact, and recommend optimizations, A/B tests or changes to creative and strategy.', pricing: { termLow: 52, termHigh: 52, budgetLow: 30000, budgetHigh: 40000, bundle: 'Integrated Reporting' } },
    ],
    triggerPatterns: {
      direct: ['don\'t know if marketing is working', 'need better reporting', 'need to track performance', 'can\'t prove ROI'],
      indirect: ['decisions without data', 'tools not integrated', 'leadership asking for accountability', 'budget justification challenges', 'unclear attribution'],
      situational: ['new leadership demanding accountability', 'budget review', 'board reporting', 'marketing technology audit', 'new initiatives'],
      performance: ['can\'t report on basic metrics', 'data conflicts between systems', 'no baseline', 'unknown customer journey', 'efficiency unclear'],
      sampleLanguage: ['have no idea what\'s working', 'data is all over the place', 'can\'t connect marketing to sales', 'board wants to see ROI', 'decisions based on gut feel', 'each tool tells us something different', 'need a dashboard that makes sense', 'can\'t justify marketing spend']
    }
  },
  {
    id: 'gtm',
    category: 'Go-to-Market Strategy',
    description: 'Launch products and enter markets',
    engagementType: 'fixed_fee',
    services: [
      // GTM Strategy bundle
      { name: 'Go-to-Market Strategy', recommend: 'always', condition: 'for all GTM projects', pricing: { termLow: 1, termHigh: 3, budgetLow: 10000, budgetHigh: 30000, bundle: 'GTM Strategy' } },
      { name: 'Launch Planning', recommend: 'always', condition: 'for all GTM projects', pricing: { bundle: 'GTM Strategy' } },
      { name: 'Market Entry Strategy', recommend: 'conditional', condition: 'when entering new markets', pricing: { bundle: 'GTM Strategy' } },
      { name: 'Channel Strategy', recommend: 'conditional', condition: 'when distribution channels need defining', pricing: { bundle: 'GTM Strategy' } },
      { name: 'Sales Enablement', recommend: 'conditional', condition: 'when sales team support is needed', pricing: { bundle: 'GTM Strategy' } },
    ],
    triggerPatterns: {
      direct: ['launching a new product', 'need a GTM strategy', 'need to bring this to market', 'entering a new market'],
      indirect: ['uncertainty about target audience', 'no launch plan', 'pricing and positioning questions', 'channel strategy unclear', 'sales and marketing alignment needed'],
      situational: ['product development completion', 'service line expansion', 'market expansion', 'competitive response', 'acquisition of new capabilities'],
      performance: ['previous launches underperformed', 'new product uptake slow', 'market penetration below expectations', 'customer acquisition challenges', 'sales cycle too long'],
      sampleLanguage: ['launching in Q[X] and need a plan', 'built something great but don\'t know how to sell it', 'need to understand who will buy this', 'how do we price this', 'entering a new category', 'need to generate demand quickly', 'last launch didn\'t go well', 'have the product but not the plan']
    }
  },
  {
    id: 'events',
    category: 'Event Planning & Production',
    description: 'Plan and execute events',
    engagementType: 'fixed_fee',
    services: [
      // Event Strategy bundle
      { name: 'Event Strategy', recommend: 'always', condition: 'for all event projects', pricing: { termLow: 4, termHigh: 6, budgetLow: 10000, budgetHigh: 20000, bundle: 'Event Strategy', note: 'Excludes venue and vendor costs' } },
      // Event Production bundle
      { name: 'Event Production', recommend: 'always', condition: 'for all event projects', pricing: { termLow: 4, termHigh: 12, budgetLow: 15000, budgetHigh: 100000, bundle: 'Event Production' } },
      { name: 'Virtual Event Production', recommend: 'conditional', condition: 'when virtual or hybrid events are needed', pricing: { termLow: 2, termHigh: 4, budgetLow: 15000, budgetHigh: 30000, bundle: 'Event Production' } },
      { name: 'Trade Show Management', recommend: 'conditional', condition: 'when trade show participation is involved', pricing: { termLow: 2, termHigh: 4, budgetLow: 15000, budgetHigh: 30000, bundle: 'Event Production' } },
      { name: 'Speaker Management', recommend: 'conditional', condition: 'when speakers need coordination', pricing: { termLow: 2, termHigh: 4, budgetLow: 5000, budgetHigh: 15000, bundle: 'Event Production' } },
      // Event Marketing bundle
      { name: 'Event Marketing', recommend: 'conditional', condition: 'when event promotion is needed', pricing: { termLow: 2, termHigh: 6, budgetLow: 10000, budgetHigh: 20000, bundle: 'Event Marketing' } },
    ],
    triggerPatterns: {
      direct: ['have an event coming up', 'need to plan a conference', 'need event support'],
      indirect: ['team doesn\'t have event experience', 'past events had issues', 'budget requires professional management', 'complex logistics', 'need creative concepts'],
      situational: ['annual conference', 'product launch event', 'customer events', 'trade show', 'employee events', 'milestone celebrations', 'investor events'],
      performance: ['event feedback poor', 'attendance declining', 'event ROI unclear', 'logistics challenges', 'content quality inconsistent'],
      sampleLanguage: ['have our annual conference and need help', 'want to make this event memorable', 'don\'t have time to plan ourselves', 'need vendors and don\'t know where to start', 'last event was a disaster', 'want to elevate our event experience', 'need creative ideas for the event', 'budget is tight but want something special']
    }
  },
  {
    id: 'training',
    category: 'Communications Training',
    description: 'Media and communications training',
    engagementType: 'fixed_fee',
    services: [
      // Communications Training bundle
      { name: 'Media & Spokesperson Training', recommend: 'always', condition: 'for all communications training', pricing: { termLow: 2, termHigh: 4, budgetLow: 20000, budgetHigh: 50000, bundle: 'Communications Training', note: 'Per session or program' } },
      { name: 'Presentation Training', recommend: 'conditional', condition: 'when presentation skills are needed', pricing: { bundle: 'Communications Training' } },
      { name: 'Crisis Communications Training', recommend: 'conditional', condition: 'when crisis preparedness is needed', pricing: { bundle: 'Communications Training' } },
      { name: 'Brand Training', recommend: 'conditional', condition: 'when brand alignment training is needed', pricing: { bundle: 'Communications Training' } },
    ],
    triggerPatterns: {
      direct: ['team needs media training', 'need communications training', 'executives need spokesperson prep', 'want internal training'],
      indirect: ['executives uncomfortable with media', 'teams lack marketing skills', 'inconsistent brand representation', 'new hires need onboarding', 'crisis preparedness concerns'],
      situational: ['new spokesperson', 'upcoming media tour', 'crisis preparation', 'marketing team expansion', 'leadership changes', 'brand launch'],
      performance: ['poor media interview performance', 'inconsistent external communication', 'brand message dilution', 'crisis response failures', 'employee communications issues'],
      sampleLanguage: ['CEO freezes in front of cameras', 'need help training our team', 'spokespeople need practice', 'want to be prepared if something goes wrong', 'new team members need to understand our brand', 'marketing team has skill gaps']
    }
  },
  {
    id: 'impact',
    category: 'Impact & Purpose Communications',
    description: 'Sustainability, impact, and purpose communications',
    engagementType: 'fixed_fee',
    services: [
      // Impact Reporting bundle
      { name: 'Impact Report Writing & Design', recommend: 'always', condition: 'when impact/sustainability report is needed', pricing: { termLow: 4, termHigh: 12, budgetLow: 40000, budgetHigh: 80000, bundle: 'Impact Reporting' } },
      // Impact Communications bundle
      { name: 'Sustainability Communications Messaging', recommend: 'conditional', condition: 'when sustainability messaging is needed', pricing: { termLow: 3, termHigh: 5, budgetLow: 15000, budgetHigh: 20000, bundle: 'Impact Communications' } },
      { name: 'Purpose Discovery Workshop', recommend: 'conditional', condition: 'when purpose definition is needed', pricing: { termLow: 1, termHigh: 2, budgetLow: 8000, budgetHigh: 10000, bundle: 'Impact Communications' } },
    ],
    triggerPatterns: {
      direct: ['need an annual report', 'need an impact report', 'need help with CSR report', 'want to showcase our impact', 'impact story', 'sustainability story', 'esg communications', 'purpose driven'],
      indirect: ['stakeholder expectations for transparency', 'ESG reporting requirements', 'investor relations needs', 'employee engagement communications', 'competitor reports setting higher bar', 'customers want to know our values'],
      situational: ['annual reporting cycle', 'sustainability milestones', 'stakeholder meeting', 'grant reporting', 'public accountability', 'B Corp certification'],
      performance: ['stakeholder feedback on transparency', 'competitor reports more compelling', 'internal data not shared', 'impact not being communicated', 'brand purpose scores low'],
      sampleLanguage: ['do great work but don\'t communicate it', 'report needs to be more compelling', 'have the data but need help presenting it', 'stakeholders want more transparency', 'competitors have beautiful impact reports', 'need to tell our sustainability story', 'want people to know we\'re more than just a business']
    }
  },
  {
    id: 'content_production',
    category: 'Content Ideation & Production',
    description: 'Content strategy and creation',
    engagementType: 'fixed_fee',
    services: [
      // Content Strategy bundle
      { name: 'Content Strategy', recommend: 'always', condition: 'when client needs creative (designed or animated content to be produced', pricing: { termLow: 2, termHigh: 4, budgetLow: 15000, budgetHigh: 30000, bundle: 'Content Strategy', note: 'Fixed Fee deliverable' } },
      { name: 'Content Calendar Development', recommend: 'always', condition: 'when client needs content produced and distributed over time', pricing: { termLow: 2, termHigh: 4, bundle: 'Content Strategy', note: 'Annual T&M based on volume' } },
      // Content Production bundle
      { name: 'Blog & Article Writing', recommend: 'conditional', condition: 'only if requested or included in Additional Notes. For client or prospects own channels or to gues write on a partners channel when they are looking for greater visibility for leaders.', pricing: { termLow: 1, termHigh: 2, budgetLow: 3500, budgetHigh: 8000, bundle: 'Content Production', note: 'T&M ongoing' } },
      { name: 'Podcast Production', recommend: 'conditional', condition: 'only if requested or included in Additional Notes', pricing: { termLow: 1, termHigh: 2, budgetLow: 3500, budgetHigh: 10000, bundle: 'Content Production' } },
      { name: 'Video Content Series', recommend: 'conditional', condition: 'only if requested or included in Additional Notes', pricing: { termLow: 2, termHigh: 4, budgetLow: 10000, budgetHigh: 50000, bundle: 'Content Production' } },
      { name: 'Thought Leadership Content', recommend: 'conditional', condition: 'These is when client needs articles ghost written for them in teh voice of their brand or executives', pricing: { termLow: 1, termHigh: 2, budgetLow: 6000, budgetHigh: 10000, bundle: 'Content Production' } },
      // Reactive Content Engine bundle
      { name: 'Social Content Creation (Reactive)', recommend: 'conditional', condition: 'only if requested or social media management needed and reactive content that hacks into news stories and responds to current events and competitor activity. Sold as a retainer that includes story mining, ideation adn production. All quick production and approvals.', pricing: { termLow: 52, termHigh: 52, budgetLow: 60000, budgetHigh: 120000, bundle: 'Reactive Content Engine' } },
    ],
    triggerPatterns: {
      direct: ['need more content', 'need a content strategy', 'run out of ideas', 'need help producing content'],
      indirect: ['content calendar empty', 'publishing frequency declined', 'team stretched too thin', 'quality inconsistent', 'topics not resonating'],
      situational: ['blog launch', 'newsletter launch', 'podcast initiative', 'video series', 'campaign content', 'thought leadership program'],
      performance: ['content engagement declining', 'audience growth stalled', 'SEO content needed', 'social content underperforming', 'lead magnet requests'],
      sampleLanguage: ['know we need content but don\'t know what to create', 'started a blog but ran out of steam', 'team doesn\'t have time to write', 'need fresh ideas', 'content isn\'t getting engagement', 'want to start a podcast', 'need more lead magnets']
    }
  },
  {
    id: 'operational_support',
    category: 'Operational Support',
    description: 'Operational Support',
    engagementType: 'retainer',
    services: [
      { name: 'Project Management', recommend: 'always', condition: 'when PM support is requested', pricing: { termLow: 52, termHigh: 52, percentageOfProject: 10, note: 'Approximately 15% of total project fee. Not required on PR/Earned-only engagements.' } },
      { name: 'Marketing Operations', recommend: 'conditional', condition: 'when paid media is included and operational support is needed', pricing: { termLow: 52, termHigh: 52, percentageOfPaidMedia: 10, note: '~10% of paid media management fees' } },
      { name: 'Cross-agency Coordination', recommend: 'conditional', condition: 'when cross agency coordimnation is requested to manage other third party vendors or agencies.', pricing: { termLow: 52, termHigh: 52, budgetLow: 24000, budgetHigh: 50000 } },
      { name: 'Onboarding', recommend: 'conditional', condition: 'required if first engagment to onboard to ways of working and existing platforms so we can be afective.', pricing: { termLow: 1, termHigh: 2, budgetLow: 5000, budgetHigh: 15000, note: '$5K-$10K/month, for managing other agencies, partners and third parties' } },
      { name: 'Client Side Project Management', recommend: 'conditional', condition: 'If we need top offer project management support to help coordinate clients internal operation. Project Management as a service,', pricing: { termLow: 52, termHigh: 52, budgetLow: 60000, budgetHigh: 120000 } },
    ],
    triggerPatterns: {
      direct: [],
      indirect: [],
      situational: [],
      performance: [],
      sampleLanguage: []
    }
  },
];
// === SYNC:SERVICE_TRIGGERS_END ===
// Helper function to extract service name from service object or string
const getServiceName = (service) => {
  return typeof service === 'object' ? service.name : service;
};

// Helper function to get all service names from a trigger
const getServiceNames = (trigger) => {
  return trigger.services.map(getServiceName);
};

// ============================================================================
// ENGAGEMENT TYPES FOR DRAFTING
// ============================================================================
const DRAFT_ENGAGEMENT_TYPES = [
  { value: 'fixed_fee', label: 'Fixed Fee', description: 'Set price for defined deliverables' },
  { value: 'retainer', label: 'Retainer', description: 'Ongoing monthly engagement' },
  { value: 'tm', label: 'Time & Materials', description: 'Hourly billing with minimum commitment' },
  { value: 'integrated', label: 'Integrated', description: 'Multi-phase with mixed billing models' },
  { value: 'tm_cap', label: 'T&M with Cap', description: 'Hourly with maximum (client request only)' }
];

// ============================================================================
// FIT ARCHETYPES
// ============================================================================
const FIT_ARCHETYPES = {
  architect: {
    id: 'architect',
    title: 'Architect',
    emoji: '📐',
    short: 'Strategic & Systematic',
    description: 'Values systematic approaches, formal planning, and proven methodologies.',
    // Categories to boost — conditional services in these become auto-selected
    boostCategories: ['integrated_strategy', 'brand', 'executive_visibility', 'measurement', 'pr', 'training'],
    // Specific services to auto-select if the category is detected
    boostServices: [
      'Marketing Strategy Development', 'Customer Journey Mapping', 'Marketing Audit & Assessment (Compass)',
      'Brand Research (Compass)', 'Stakeholder Interviews (IDIs)', 'Brand Workshop',
      'Analytics Strategy & Measurement Framework', 'KPI Development', 'Marketing ROI Framework',
      'Executive Positioning Strategy', 'Brand Guidelines'
    ],
    sowGuidance: `CLIENT FIT ARCHETYPE: ARCHITECT
This client values strategic thinking and systematic approaches. The SOW should:
- Emphasize strategic rationale and methodology behind each recommendation
- Include detailed phasing with clear dependencies between workstreams
- Present formal review and governance structures
- Frame deliverables in terms of long-term brand and business impact
- Use language that conveys thoughtful planning: "strategic framework", "phased approach", "stakeholder alignment"
- Include robust reporting and measurement sections
- Emphasize proven methodologies and industry best practices`,
    waysOfWorking: `WAYS OF WORKING — ARCHITECT CLIENT
Governance & Process:
- Formal kickoff with comprehensive briefing and stakeholder alignment session
- Structured governance model: Steering committee reviews at phase gates, working team reviews bi-weekly
- All strategic recommendations presented in formal deck format with data rationale
- Phased work plans with clear dependencies — each phase has defined entry/exit criteria before proceeding
- Change requests require written submission and formal impact assessment before approval

Communication Cadence:
- Bi-weekly status reports with progress against milestones, budget tracking, and risk register
- Monthly strategic review meetings with senior stakeholders
- Quarterly business reviews assessing program-level impact against objectives
- All deliverables accompanied by strategic rationale documentation

Approval & Decision Flow:
- Defined approval hierarchy: day-to-day decisions via designated point of contact, strategic decisions via steering committee
- Client provides consolidated feedback representing unified organizational direction within agreed windows
- Formal sign-off required at each phase gate before subsequent work commences

Reporting & Documentation:
- Comprehensive project documentation maintained throughout engagement
- Post-phase retrospectives with lessons learned and optimization recommendations
- Final engagement report summarizing outcomes against stated objectives`,
    pricingGuidance: `PRICING APPROACH — ARCHITECT CLIENT
- Frame fees as investment in strategic foundation and long-term brand building
- Present comprehensive, all-inclusive phase pricing — Architects prefer clarity over modular á la carte
- Emphasize the value of thorough upfront strategy to prevent costly rework downstream
- Structure payments around phase gates and milestone approvals
- Include detailed assumptions section — Architects want to understand what underlies the pricing
- Where applicable, present multi-year or programmatic pricing that rewards sustained commitment
- Include rate card for additional work but position it as exception, not expectation`
  },
  visionary: {
    id: 'visionary',
    title: 'Visionary',
    emoji: '✨',
    short: 'Creative & Bold',
    description: 'Prioritizes authentic brand expression, breakthrough ideas, and bold creative risks.',
    boostCategories: ['brand', 'creative_production', 'creative_campaigns', 'influencer', 'content_production'],
    boostServices: [
      'Creative Platform Development', 'Big Idea Generation', 'Experiential Concepts',
      'Tone of Voice', 'Manifesto', 'Visual Identity System', 'Logo/Wordmark Development',
      'Graphic Design', 'Video Production', 'Animation & Motion Graphics',
      'Influencer Strategy', 'Content Strategy'
    ],
    sowGuidance: `CLIENT FIT ARCHETYPE: VISIONARY
This client values creative breakthrough and authentic expression. The SOW should:
- Lead with creative ambition and the opportunity for breakthrough work
- Frame services as collaborative creative partnerships, not just deliverables
- Emphasize creative exploration phases and concept development
- Lean toward creative retainers and retained creative services for ongoing inspiration
- Use language that conveys creative ambition: "breakthrough concepts", "authentic expression", "creative exploration"
- Include creative workshops and collaborative ideation sessions
- Describe revision processes as "creative refinement" rather than correction cycles
- Emphasize brand storytelling and cultural relevance`,
    waysOfWorking: `WAYS OF WORKING — VISIONARY CLIENT
Creative Partnership Model:
- Immersive kickoff: Deep-dive brand immersion session including culture, mission, aesthetic references, and creative ambitions
- Collaborative creative workshops at key moments — Agency brings provocative stimulus; Client brings brand truth
- Creative exploration phase built into every engagement before execution begins — space to ideate without constraint
- Concept presentations as storytelling moments: show the journey from insight to idea, not just final output
- Creative refinement rounds (not "revisions") — iterative evolution toward breakthrough, not correction cycles

Communication Cadence:
- Regular creative check-ins: informal, visual, collaborative — share mood boards, references, work-in-progress
- Status updates focused on creative narrative and brand journey, not just task completion
- Quarterly inspiration sessions: Agency proactively brings cultural trends, competitive creative, and breakthrough opportunities
- Open creative dialogue encouraged between sessions — this is a partnership, not a vendor relationship

Approval & Decision Flow:
- Creative direction established collaboratively at outset — shared vision document as ongoing reference
- Client empowered to make bold creative decisions quickly — minimize approval layers that dilute ideas
- Feedback framed as creative direction, not prescriptive edits: "we want it to feel more…" not "change the font to…"
- Agency retains creative recommendation authority — Client trusts Agency to push boundaries while respecting brand truth

Reporting & Documentation:
- Portfolio-style creative reviews showcasing body of work and brand evolution
- Impact measured through brand expression metrics: distinctiveness, cultural relevance, creative recognition
- End-of-engagement creative retrospective: what we built, what we learned, where the brand goes next`,
    pricingGuidance: `PRICING APPROACH — VISIONARY CLIENT
- Frame fees as investment in creative partnership and brand differentiation
- Lean toward creative retainers and T&M with minimum commitment — Visionaries need ongoing creative access, not one-off projects
- Include dedicated creative exploration / concept development budgets as line items — this isn't overhead, it's the work
- Structure retained creative services with monthly creative commitment rather than rigid deliverable counts
- Position premium pricing confidently — breakthrough creative commands premium investment
- For project work, include concept development phase pricing separately from production execution
- Build in flexibility for inspiration-driven pivots without triggering change orders for every creative evolution`
  },
  accelerator: {
    id: 'accelerator',
    title: 'Accelerator',
    emoji: '📊',
    short: 'Performance & Data-Driven',
    description: 'Demands measurable results, data-driven decisions, and performance optimization.',
    boostCategories: ['paid_media', 'social_media', 'measurement', 'integrated_measurement', 'seo', 'geo'],
    boostServices: [
      'Conversion Rate Optimization', 'On-Page Optimization', 'SEO Reporting',
      'Analytics Strategy & Measurement Framework', 'Integrated Dashboard Development', 'Attribution Modeling', 'Marketing ROI Framework', 'KPI Development',
      'Paid Strategy', 'Paid Media Reporting', 'Campaign Setup & Management',
      'SEO Strategy & Audit', 'Reporting'
    ],
    sowGuidance: `CLIENT FIT ARCHETYPE: ACCELERATOR
This client values measurable performance and data-driven optimization. The SOW should:
- Lead with KPIs, success metrics, and measurable outcomes for every service
- Include robust measurement frameworks and reporting cadences
- Emphasize performance marketing, A/B testing, and optimization cycles
- Include dashboard development and real-time performance visibility
- Use language that conveys accountability: "measurable outcomes", "KPI targets", "data-driven optimization"
- Frame creative work in terms of conversion impact and performance metrics
- Include regular performance review cadences (weekly/monthly)
- Define clear benchmarks and improvement targets within 90-day windows`,
    waysOfWorking: `WAYS OF WORKING — ACCELERATOR CLIENT
Performance-Driven Operations:
- Data-first kickoff: Establish baseline metrics, define KPIs, agree on measurement framework and attribution model before work begins
- 90-day goal cycles: All work structured around quarterly performance targets with mid-cycle optimization checkpoints
- Test-measure-optimize loop built into every workstream — no creative or strategy ships without a hypothesis and success metric
- Weekly optimization cadence: Agency reviews performance data and makes tactical adjustments within pre-approved parameters
- Continuous A/B testing protocol: systematic testing calendar for creative, messaging, audiences, and channels

Communication Cadence:
- Real-time performance dashboards with Client access — no waiting for reports to see what's working
- Weekly performance pulse: brief data-driven update on key metrics, wins, and optimization actions taken
- Monthly deep-dive performance reviews with trend analysis, test results, and next optimization priorities
- Quarterly strategic reviews connecting performance data to business outcomes and adjusting targets

Approval & Decision Flow:
- Pre-approved optimization parameters: Agency authorized to make tactical changes (bid adjustments, creative rotation, audience refinement) within defined boundaries without per-change approval
- Strategic pivots (new channels, significant budget reallocation, messaging overhaul) require Client approval with data justification
- Decisions backed by data — Agency presents options with projected performance impact; Client decides based on numbers
- Rapid approval process: 24-48 hour turnaround on optimization recommendations to maintain momentum

Reporting & Documentation:
- Automated performance dashboards updated daily/weekly
- Monthly performance reports with clear KPI tracking, trend analysis, and actionable recommendations
- Test log documenting all experiments, hypotheses, results, and learnings
- Quarterly business impact assessment connecting marketing performance to revenue and growth metrics`,
    pricingGuidance: `PRICING APPROACH — ACCELERATOR CLIENT
- Frame fees in terms of performance investment and measurable return
- Include measurement and analytics setup as a foundational line item — not optional, essential
- Structure ongoing services around optimization cycles with clear performance benchmarks
- Consider performance review cadences as part of the service value, not administrative overhead
- Present pricing with associated KPIs: "This investment targets [X] improvement in [metric] within [timeframe]"
- Include dashboard development and reporting infrastructure in the initial scope — Accelerators need visibility from day one
- For retainers, emphasize efficiency gains over time: optimization drives more value from the same investment
- Budget for systematic A/B testing — position it as essential to performance improvement, not discretionary`
  },
  entrepreneur: {
    id: 'entrepreneur',
    title: 'Entrepreneur',
    emoji: '🚀',
    short: 'Fast & Action-Oriented',
    description: 'Needs flexible, action-oriented partnerships with quick wins at entrepreneurial pace.',
    boostCategories: ['gtm', 'paid_media', 'social_media', 'creative_campaigns', 'content_production'],
    boostServices: [
      'Go-to-Market Strategy', 'Launch Planning', 'Channel Strategy',
      'Landing Page Development', 'On-Page Optimization',
      'Creative Platform Development', 'Campaign Asset Creation',
      'Paid Strategy', 'Audience Development & Targeting',
      'Content Strategy', 'Social Content Creation (Reactive)'
    ],
    sowGuidance: `CLIENT FIT ARCHETYPE: ENTREPRENEUR
This client values speed, flexibility, and quick wins. The SOW should:
- Emphasize fast starts with rapid hypothesis-driven strategy
- Structure work in short sprints rather than long phases
- Include A/B testing and test-and-learn approaches for creative platforms and paid media
- Prioritize quick wins that demonstrate value early
- Use language that conveys momentum: "rapid deployment", "test and learn", "sprint-based delivery"
- Build in flexibility for pivoting based on early results
- Include lightweight reporting focused on actionable insights over comprehensive analysis
- Emphasize getting to market quickly with creative assets across paid media and social`,
    waysOfWorking: `WAYS OF WORKING — ENTREPRENEUR CLIENT
Sprint-Based Partnership:
- Rapid-start kickoff: Abbreviated onboarding (1-2 sessions max) focused on immediate priorities and first sprint definition
- Work structured in 2-4 week sprints with defined deliverables, hypotheses, and success criteria per sprint
- Hypothesis-driven approach: "We believe [X] will achieve [Y] — let's test it" rather than months of upfront strategy
- Built-in pivot points at sprint boundaries — shift priorities based on what's working without formal change orders
- MVP-first mentality: Launch with good-enough creative, learn from real-world data, refine in subsequent sprints

Communication Cadence:
- Quick-touch check-ins: 15-30 minute weekly syncs focused on decisions, blockers, and next actions — no lengthy presentations
- Real-time communication channel (Slack/Teams) for day-to-day questions and quick approvals
- Sprint retrospectives: brief review of what shipped, what we learned, what's next
- Monthly strategic pulse: lightweight assessment of overall direction and priorities (not a formal review)

Approval & Decision Flow:
- Streamlined approvals: single decision-maker with authority to approve on the spot
- Async approval workflow for creative and content — share for review, approved unless feedback within 24-48 hours
- Agency empowered to make execution decisions within sprint scope without per-item approval
- Pivot decisions made quickly at sprint boundaries — no committee required
- "Good enough to ship" standard for initial launches; perfection is the enemy of progress

Reporting & Documentation:
- Lightweight sprint reports: what shipped, key metrics, learnings, next sprint priorities (1-2 pages max)
- Action-oriented dashboards showing what's working and what to do about it
- Monthly summary connecting sprint outputs to business growth metrics
- Documentation kept lean — enough to make decisions, not enough to slow things down`,
    pricingGuidance: `PRICING APPROACH — ENTREPRENEUR CLIENT
- Frame fees around speed-to-value and quick wins that demonstrate ROI early
- Structure pricing in sprint-based phases: small initial commitment that scales based on results
- Present a "Phase 1 Fast Start" with lower entry point, followed by expansion phases tied to early wins
- Lean toward T&M or retainer models that flex with changing priorities — Entrepreneurs hate paying for scope they've outgrown
- Include swap-in/swap-out provisions: trade equivalent deliverables without change orders as priorities shift
- Keep proposal modular — let client add services as they grow rather than requiring large upfront commitment
- Position pricing as investment in velocity: "Get to market in [X] weeks rather than [Y] months"
- Budget for test-and-learn: allocate portion of investment explicitly for experimentation across creative and channels`
  }
};

// Engagement type recommendations based on service categories
const ENGAGEMENT_TYPE_RECOMMENDATIONS = {
  // Fixed Fee is best for these categories
  fixed_fee_preferred: [
    'website',             // Website & App Development
    'brand',               // Brand Strategy & Expression
    'events',              // Event Planning & Production
    'integrated_strategy', // Upfront planning and strategy work
    'creative_campaigns',  // Ring-fenced campaigns
    'gtm',                 // Go-to-Market Strategy
    'training',            // Communications Training
    'impact',              // Impact & Purpose Communications
    'measurement',         // Measurement & Analytics (setup)
    'integrated_measurement', // Integrated Measurement & Analytics
    'orm',                 // Online Reputation Management
    'geo',                 // Generative Engine Optimization
  ],
  // T&M is best for these (with minimum spend)
  tm_preferred: [
    'creative_production', // Creative retainers
    'content_production',  // Content ideation & production
  ],
  // Retainer is best for these professional services
  retainer_preferred: [
    'pr',                  // Public Relations & Media Outreach
    'executive_visibility', // Thought Leadership
    'paid_media',          // Paid Media
    'social_media',        // Social Media
    'seo',                 // Search Engine Optimization
    'influencer',          // Influencer Marketing
  ],
  // T&M with Cap - only when client specifically requests
  tm_cap_preferred: [],  // Never recommended by default
  // Operational support can be applied to any engagement type
  any_preferred: [
    'operational_support', // Project Management, Ops, Coordination (overlay)
  ]
};

// Helper to determine billing model for a category
const getCategoryBillingModel = (categoryId) => {
  if (ENGAGEMENT_TYPE_RECOMMENDATIONS.fixed_fee_preferred.includes(categoryId)) return 'fixed_fee';
  if (ENGAGEMENT_TYPE_RECOMMENDATIONS.tm_preferred.includes(categoryId)) return 'tm';
  if (ENGAGEMENT_TYPE_RECOMMENDATIONS.retainer_preferred.includes(categoryId)) return 'retainer';
  if (ENGAGEMENT_TYPE_RECOMMENDATIONS.any_preferred.includes(categoryId)) return 'any';
  return 'fixed_fee'; // default
};

// Helper to analyze selected services and determine if integrated billing is needed
const analyzeServiceBillingModels = (selectedServices) => {
  const categoryBillingModels = {};
  const billingModelCategories = { fixed_fee: [], tm: [], retainer: [] };
  
  SERVICE_TRIGGERS.forEach(trigger => {
    const serviceNames = getServiceNames(trigger);
    const matchingServices = serviceNames.filter(s => selectedServices.includes(s));
    if (matchingServices.length > 0 && trigger.id !== 'operational_support') {
      const billingModel = getCategoryBillingModel(trigger.id);
      if (billingModel !== 'any') {
        categoryBillingModels[trigger.id] = {
          category: trigger.category,
          billingModel: billingModel,
          services: matchingServices
        };
        billingModelCategories[billingModel].push({
          id: trigger.id,
          category: trigger.category,
          services: matchingServices
        });
      }
    }
  });
  
  // Count distinct billing models needed
  const activeBillingModels = Object.keys(billingModelCategories).filter(
    model => billingModelCategories[model].length > 0
  );
  
  return {
    categoryBillingModels,
    billingModelCategories,
    activeBillingModels,
    needsIntegrated: activeBillingModels.length > 1
  };
};

// Get engagement type recommendation based on selected services
const getEngagementTypeRecommendation = (selectedServices, selectedTriggers, currentEngagementType) => {
  if (!selectedServices || selectedServices.length === 0) return null;
  
  // Analyze billing models needed
  const billingAnalysis = analyzeServiceBillingModels(selectedServices);
  
  // Count services by their parent category
  const categoryCount = {};
  SERVICE_TRIGGERS.forEach(trigger => {
    const serviceNames = getServiceNames(trigger);
    const matchingServices = serviceNames.filter(s => selectedServices.includes(s));
    if (matchingServices.length > 0) {
      categoryCount[trigger.id] = matchingServices.length;
    }
  });
  
  const categories = Object.keys(categoryCount);
  if (categories.length === 0) return null;
  
  // Determine the dominant category
  const dominantCategory = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  // Project management can be applied to any engagement type - skip recommendation
  if (dominantCategory === 'operational_support' && categories.length === 1) {
    return null;
  }
  
  // CHECK FOR INTEGRATED ENGAGEMENT FIRST
  if (billingAnalysis.needsIntegrated) {
    const modelSummary = billingAnalysis.activeBillingModels.map(model => {
      const cats = billingAnalysis.billingModelCategories[model];
      const modelLabel = model === 'fixed_fee' ? 'Fixed Fee' : model === 'tm' ? 'Time & Materials' : 'Retainer';
      return `${modelLabel}: ${cats.map(c => c.category).join(', ')}`;
    }).join(' | ');
    
    // If integrated is already selected, confirm it's good
    if (currentEngagementType === 'integrated') {
      return {
        type: 'confirmation',
        title: 'Integrated Engagement Recommended',
        message: `Your selected services span multiple billing models. The SOW will be structured with separate sections: ${modelSummary}`,
        recommendedType: 'integrated',
        budgetGuidance: 'Present fees by section: Fixed Fee phases with milestone payments, Retainer services as monthly fees, and T&M work with minimum commitments and hourly rates.',
        billingAnalysis: billingAnalysis
      };
    }
    
    // Suggest switching to integrated
    return {
      type: 'suggestion',
      title: 'Consider Integrated Engagement',
      message: `Your selected services span multiple billing models (${billingAnalysis.activeBillingModels.join(', ')}). An Integrated engagement will structure the SOW with appropriate sections for each: ${modelSummary}`,
      recommendedType: 'integrated',
      budgetGuidance: 'Present fees by section: Fixed Fee phases with milestone payments, Retainer services as monthly fees, and T&M work with minimum commitments and hourly rates.',
      billingAnalysis: billingAnalysis
    };
  }
  
  // If T&M with Cap is selected, provide specific guidance
  if (currentEngagementType === 'tm_cap') {
    return {
      type: 'warning',
      title: 'T&M with Cap: Client Request Only',
      message: 'Time & Materials with Cap should only be used when specifically requested by the client. It shifts risk to the agency. Consider if Fixed Fee or standard T&M would be more appropriate.',
      recommendedType: null,
      budgetGuidance: 'If proceeding with T&M Cap: Present cap amount with clear scope boundaries, notification thresholds at 75% consumption, and explicit language that work stops when cap is reached unless client authorizes additional budget.'
    };
  }
  
  // Check what engagement type is recommended for these services
  let recommendedType = null;
  let reason = '';
  let budgetGuidance = '';
  
  // Check fixed fee preferred
  if (ENGAGEMENT_TYPE_RECOMMENDATIONS.fixed_fee_preferred.includes(dominantCategory)) {
    recommendedType = 'fixed_fee';
    if (dominantCategory === 'website') {
      reason = 'Website and app production projects have well-defined deliverables that are best suited to Fixed Fee pricing.';
      budgetGuidance = 'Present total project fee with milestone-based payments (e.g., 50% at kickoff, 25% at design approval, 25% at launch).';
    } else if (dominantCategory === 'brand') {
      reason = 'Branding projects (strategy and expression) have defined phases and deliverables best suited to Fixed Fee pricing. Minimum project value: $50,000.';
      budgetGuidance = 'Present total project fee with phase-based payments aligned to Discovery, Strategy, and Expression phases.';
    } else if (dominantCategory === 'events') {
      reason = 'Event projects have fixed dates and defined deliverables best suited to Fixed Fee pricing.';
      budgetGuidance = 'Present total project fee with milestone payments tied to planning phases and event date.';
    } else if (dominantCategory === 'integrated_strategy') {
      reason = 'Upfront planning and strategy work has defined deliverables best suited to Fixed Fee pricing.';
      budgetGuidance = 'Present total project fee with milestone-based payments tied to deliverable phases.';
    } else if (dominantCategory === 'creative_campaigns') {
      reason = 'Ring-fenced campaigns with defined deliverables are best suited to Fixed Fee pricing.';
      budgetGuidance = 'Present total project fee with milestone-based payments tied to campaign phases.';
    } else if (dominantCategory === 'gtm') {
      reason = 'Go-to-Market strategy projects have defined phases and deliverables best suited to Fixed Fee pricing.';
      budgetGuidance = 'Present total project fee with milestone-based payments tied to GTM phases.';
    } else if (dominantCategory === 'training') {
      reason = 'Training engagements have defined sessions and deliverables best suited to Fixed Fee pricing.';
      budgetGuidance = 'Present total project fee per training session or program.';
    } else if (dominantCategory === 'impact') {
      reason = 'Impact and purpose communications projects have defined deliverables best suited to Fixed Fee pricing.';
      budgetGuidance = 'Present total project fee with milestone-based payments tied to deliverable phases.';
    } else if (dominantCategory === 'measurement') {
      reason = 'Measurement and analytics setup has defined deliverables best suited to Fixed Fee pricing.';
      budgetGuidance = 'Present total project fee for setup. Consider ongoing retainer for maintenance and reporting.';
    }
  }
  // Check T&M preferred
  else if (ENGAGEMENT_TYPE_RECOMMENDATIONS.tm_preferred.includes(dominantCategory) || 
           categories.some(c => ['creative_production', 'content_production'].includes(c))) {
    recommendedType = 'tm';
    reason = 'Creative and content work where deliverables evolve is best suited to Time & Materials with a minimum spend commitment. Include monthly/quarterly planning and prioritization language.';
    budgetGuidance = 'Present as minimum commitment (e.g., $24,000 annual minimum for creative retainer) with hourly rates for work. Include language about monthly planning sessions to prioritize work. Avoid "drawdown" language.';
  }
  // Check retainer preferred
  else if (ENGAGEMENT_TYPE_RECOMMENDATIONS.retainer_preferred.some(c => categories.includes(c))) {
    recommendedType = 'retainer';
    if (categories.includes('pr')) {
      reason = 'PR and media outreach are ongoing professional services best suited to a monthly Retainer structure. Minimum retainer: $15,000/month.';
      budgetGuidance = 'Present as monthly retainer fee with defined scope of activities per month. Include utilization tracking and overage rates.';
    } else if (categories.includes('executive_visibility')) {
      reason = 'Thought leadership is an ongoing professional service best suited to a monthly Retainer structure.';
      budgetGuidance = 'Present as monthly retainer fee with defined activities. Include utilization tracking.';
    } else if (categories.includes('paid_media')) {
      reason = 'Paid media management is an ongoing service best suited to a monthly Retainer structure.';
      budgetGuidance = 'Present as monthly retainer fee with defined scope. Separate media spend from agency fees.';
    } else if (categories.includes('social_media')) {
      reason = 'Social media management is an ongoing service best suited to a monthly Retainer structure.';
      budgetGuidance = 'Present as monthly retainer fee with defined scope of activities per month. Separate content creation from management fees.';
    } else if (categories.includes('seo') || categories.includes('geo')) {
      reason = 'SEO and GEO are ongoing optimization services best suited to a monthly Retainer structure.';
      budgetGuidance = 'Present as monthly retainer fee with defined activities and reporting.';
    } else if (categories.includes('influencer')) {
      reason = 'Influencer marketing is an ongoing service best suited to a monthly Retainer structure.';
      budgetGuidance = 'Present as monthly retainer fee with defined scope. Include utilization tracking and overage rates.';
    } else {
      reason = 'These professional services are best suited to a monthly Retainer structure.';
      budgetGuidance = 'Present as monthly retainer fee with defined scope and utilization tracking.';
    }
  }
  
  // If current selection doesn't match recommendation
  if (recommendedType && currentEngagementType && currentEngagementType !== recommendedType && currentEngagementType !== 'integrated') {
    return {
      type: 'suggestion',
      title: 'Consider a Different Engagement Type',
      message: reason,
      recommendedType: recommendedType,
      budgetGuidance: budgetGuidance
    };
  }
  
  // If selection matches recommendation, provide positive confirmation
  if (recommendedType && currentEngagementType === recommendedType) {
    return {
      type: 'confirmation',
      title: 'Good Match',
      message: reason,
      recommendedType: recommendedType,
      budgetGuidance: budgetGuidance
    };
  }
  
  return null;
};

// ============================================================================
// REVIEW ENGAGEMENT TYPES (existing)
// ============================================================================
const REVIEW_ENGAGEMENT_TYPES = [
  { value: 'branding', label: 'Branding', description: 'Brand strategy, identity, guidelines' },
  { value: 'website', label: 'Website', description: 'Web design, development, CMS' },
  { value: 'pr_comms', label: 'PR / Communications', description: 'Media relations, thought leadership' },
  { value: 'creative_retainer', label: 'Creative Retainer', description: 'Ongoing creative support' },
  { value: 'integrated', label: 'Integrated', description: 'Multi-service campaigns' }
];

// ============================================================================
// PRICING GUIDE FOR SOW REVIEW VALIDATION
// ============================================================================
// === SYNC:PRICING_GUIDE_START ===
const PRICING_GUIDE = `
## SERVICE PRICING GUIDE - For Validation

Use this guide to validate pricing in SOWs. Flag fees that are significantly below the low range (underpriced) or above the high range (overpriced).

### Website & App Development (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Website Strategy & Planning [Standard Website Offering] | 8-20 weeks | $40,000 - $140,000 |
| Website Refresh | 5-8 weeks | $20,000 - $30,000 |
| Mobile App Development | 3-10 weeks | $10,000 - $60,000 |
| Landing Page Development | 1-3 weeks | $10,000 - $15,000 |
| Website Migration | 1-4 weeks | $10,000 - $60,000 |
| Performance Optimization and Support | Annual | $24,000 - $30,000 (Annual retainer) |

### Integrated Marketing Strategy (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Marketing Strategy Development | 1-4 weeks | $10,000 - $25,000 |
| Channel Planning & Media Mix & Connections Planning | 1-3 weeks | $10,000 - $20,000 |
| Primary audience research | 4-6 weeks | $25,000 - $35,000 |
| Customer Journey Mapping | 1-2 weeks | $7,000 - $15,000 |
| Marketing Audit & Assessment (Compass) | 1-2 weeks | $3,000 - $4,000 |
| Market & Competitive Research | 1-2 weeks | $2,000 - $30,000 |
| Audience Research & Segmentation | 1-2 weeks | $2,000 - $5,000 |

### Brand Strategy & Expression (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Brand Research (Compass) [Brand Strategy] | 2-4 weeks | $15,000 - $20,000 |
| Tone of Voice [Brand Expression] | 3-7 weeks | $25,000 - $30,000 |
| Brand Deck Asset Production [Brand Expression] | 1-4 weeks | $10,000 - $30,000 |
| Social Lock-ups [Brand Assets] | 1-2 weeks | $10,000 - $15,000 |

### Creative Production (Time & Materials)
| Service | Term | Budget Range |
|---------|------|--------------|
| Graphic Design [Creative Retainer] | Annual | $24,000 - $80,000 (Annual minimum commitment) |

### Influencer Marketing (Retainer)
| Service | Term | Budget Range |
|---------|------|--------------|
| Influencer Strategy [Influencer Retainer] | Annual | $30,000 - $100,000 (Annual retainer, excludes creator fees) |

### Creative Campaigns & Innovation (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Creative Platform Development [Creative Campaigns] | 2-7 weeks | $18,000 - $30,000 |

### Public Relations & Media Outreach (Retainer)
| Service | Term | Budget Range |
|---------|------|--------------|
| Media Relations [Standard PR] | Annual | $180,000 - $360,000 (Annual retainer ($15K-$30K/month)) |
| Narrative & Media Messaging [Standard PR] | 4-6 weeks | $10,000 - $20,000 |
| Media Training | 2-4 weeks | $3,000 - $10,000 (Annual or per session) |
| Crises Plan Development [Crises Comms] | 1-6 weeks | $15,000 - $40,000 |
| Crisis Communications [Crises Comms] | 1-6 weeks | $20,000 - $100,000 (T&M based on severity) |
| Media Monitoring [Standard PR] | Annual | $12,000 - $40,000 (Annual, excludes tool costs) |
| Earned Media Strategy [Standard PR] | 2-4 weeks | $10,000 - $25,000 (T&M per opportunity) |
| Announcement Strategy | 1-2 weeks | $5,000 - $10,000 |
| Earned content creation | Annual | $12,000 - $60,000 |
| Onsite media liaison | 0-1 weeks | $5,000 - $10,000 |
| Events and meetings travel | 0 weeks | $5,000 - $10,000 |

### Executive Visibility & Thought Leadership (Retainer)
| Service | Term | Budget Range |
|---------|------|--------------|
| Executive Positioning Strategy [Executive Visibility] | Annual | $60,000 - $180,000 (Annual retainer ($5K-$15K/month per executive)) |
| Speaking Opportunity Strategy | 1-3 weeks | $5,000 - $10,000 |
| Onsite Media & Exec Support | 1 weeks | $5,000 - $8,000 |
| Executive Social Media Strategy | 1-3 weeks | $5,000 - $10,000 |
| Awards Strategy | 1 weeks | $5,000 - $8,000 |
| Podcast Guest Strategy | 1 weeks | $5,000 - $8,000 |

### Paid Media (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Paid Strategy [Paid Media Strategy] | 2-6 weeks | $10,000 - $30,000 (Annual retainer, excludes media spend) |
| Campaign Setup & Management [Paid Media Execution] | 4-52 weeks | $10,000 - $100,000 |
| Audience Development & Targeting [Paid Media Execution] | 2-4 weeks | $10,000 - $20,000 |
| Ad Creative Development [Paid Media Execution] | 4-52 weeks | $24,000 - $60,000 |
| Paid Media Reporting [Paid Media Execution] | 4-52 weeks | $8,000 - $60,000 |

### Social Media (Retainer)
| Service | Term | Budget Range |
|---------|------|--------------|
| Social Media Strategy [Social Media Strategy] | 2-6 weeks | $15,000 - $25,000 (Annual retainer, excludes media spend) |
| Channel Set Up [Social Execution] | 1-3 weeks | $10,000 - $20,000 |
| Community Management [Social Execution] | 4-52 weeks | $4,000 - $60,000 |
| Social creative [Social Execution] | 4-52 weeks | $24,000 - $60,000 |
| Social Media Reporting [Social Execution] | 4-52 weeks | $8,000 - $60,000 |

### Search Engine Optimization (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| SEO Strategy & Audit [SEO Strategy] | 4-8 weeks | $20,000 - $35,000 (Annual retainer ($5K-$10K/month), 6-month minimum) |
| On-Page Optimization [SEO Execution] | 4-12 weeks | $24,000 - $60,000 |
| SEO Reporting [SEO Reporting] | 4-52 weeks | $4,000 - $40,000 |

### Online Reputation Management (ORM) (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| GEO Strategy & Audit [GEO Strategy] | 1-4 weeks | $10,000 - $20,000 (Annual retainer, often bundled with SEO) |

### Generative Engine Optimization (ORM) (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Reddit Optimization [GEO Execution] | 4-6 weeks | $20,000 - $30,000 |
| Wikipedia Optimization [GEO Execution] | 3-4 weeks | $10,000 - $15,000 |
| Earned Strategy for GEO [GEO Execution] | 2-4 weeks | $10,000 - $15,000 |

### Integrated Measurement & Analytics (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Analytics Strategy & Measurement Framework [Integrated Measurement Strategy] | 2-4 weeks | $10,000 - $20,000 |

### Measurement & Analytics (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Integrated Dashboard Development [Integrated Measurement Strategy] | 2-4 weeks | $10,000 - $20,000 |
| Attribution Modeling [Integrated Measurement Strategy] | 1-2 weeks | $10,000 - $20,000 |
| Marketing ROI Framework [Integrated Measurement Strategy] | 2-3 weeks | $10,000 - $20,000 |
| KPI Development [Integrated Measurement Strategy] | 1-2 weeks | $10,000 - $20,000 |
| Data Integration [Integrated Measurement Strategy] | 2-4 weeks | $20,000 - $30,000 |
| Reporting [Integrated Reporting] | Annual | $30,000 - $40,000 |

### Go-to-Market Strategy (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Go-to-Market Strategy [GTM Strategy] | 1-3 weeks | $10,000 - $30,000 |

### Event Planning & Production (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Event Strategy [Event Strategy] | 4-6 weeks | $10,000 - $20,000 (Excludes venue and vendor costs) |
| Event Production [Event Production] | 4-12 weeks | $15,000 - $100,000 |
| Virtual Event Production [Event Production] | 2-4 weeks | $15,000 - $30,000 |
| Trade Show Management [Event Production] | 2-4 weeks | $15,000 - $30,000 |
| Speaker Management [Event Production] | 2-4 weeks | $5,000 - $15,000 |
| Event Marketing [Event Marketing] | 2-6 weeks | $10,000 - $20,000 |

### Communications Training (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Media & Spokesperson Training [Communications Training] | 2-4 weeks | $20,000 - $50,000 (Per session or program) |

### Impact & Purpose Communications (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Impact Report Writing & Design [Impact Reporting] | 4-12 weeks | $40,000 - $80,000 |
| Sustainability Communications Messaging [Impact Communications] | 3-5 weeks | $15,000 - $20,000 |
| Purpose Discovery Workshop [Impact Communications] | 1-2 weeks | $8,000 - $10,000 |

### Content Ideation & Production (Fixed Fee)
| Service | Term | Budget Range |
|---------|------|--------------|
| Content Strategy [Content Strategy] | 2-4 weeks | $15,000 - $30,000 (Fixed Fee deliverable) |
| Blog & Article Writing [Content Production] | 1-2 weeks | $3,500 - $8,000 (T&M ongoing) |
| Podcast Production [Content Production] | 1-2 weeks | $3,500 - $10,000 |
| Video Content Series [Content Production] | 2-4 weeks | $10,000 - $50,000 |
| Thought Leadership Content [Content Production] | 1-2 weeks | $6,000 - $10,000 |
| Social Content Creation (Reactive) [Reactive Content Engine] | Annual | $60,000 - $120,000 |

### Operational Support (Retainer)
| Service | Term | Budget Range |
|---------|------|--------------|
| Project Management | Annual | ~10% of total project fee |
| Marketing Operations | Annual | ~10% of paid media management fees |
| Cross-agency Coordination | Annual | $24,000 - $50,000 |
| Onboarding | 1-2 weeks | $5,000 - $15,000 ($5K-$10K/month, for managing other agencies, partners and third parties) |
| Client Side Project Management | Annual | $60,000 - $120,000 |
`;
// === SYNC:PRICING_GUIDE_END ===

// ============================================================================
// ASSESSMENT FRAMEWORK (Comprehensive - for review flow)
// ============================================================================
const ASSESSMENT_FRAMEWORK = `
# SOW Assessment Framework (Comprehensive)

A Statement of Work serves as both a legal document and project management tool. Its purposes are:
- Establishing clear, mutual understanding about what is being delivered, how, when, and under what terms
- Transforming high-level commitments into actionable plans
- Preventing scope creep by distinguishing between what is included and what falls outside boundaries
- Reducing disputes by establishing accountability measures and performance standards
- Serving as the single source of truth throughout the project lifecycle

## Reference Standards by Engagement Type
- Branding: Switch Energy Alliance SOW (R1000)
- Website: Echogen SOW  
- Integrated: DER Coalition SOW (R9278)
- Creative Retainers: Integrated Creative & Strategic Support Retainer
- PR/Comms: TerraPower UK PR Support SOW

## Antenna Group Pricing Minimums
When recommending budget language, DO NOT invent numbers. Use "$xxxx.xx" as placeholder UNLESS:
- The SOW already contains specific budget values (use those)
- It's one of these known minimums:
  • Branding Strategy & Expression projects: $50,000 minimum
  • Creative T&M retainer deposit: $24,000 minimum
  • Brand assessment: $4,000
  • Minimum retainers: $15,000

---

## PART 1: ESSENTIAL SOW COMPONENTS (Verify presence and quality)

### 1.1 Project Overview and Background
Must include:
- Context for the project and its purpose
- Business need being addressed
- Parties involved
- High-level success criteria

FLAGS:
✗ Missing context that helps readers understand purpose
✗ No stated business objective or success criteria
✗ Unclear identification of parties

### 1.2 Objectives and Purpose
Must include:
- Specific goals the project aims to achieve
- Measurable definition of success
- Alignment with client's stated business objectives

FLAGS:
✗ Vague objectives that cannot be measured
✗ Objectives stated as activities rather than outcomes
✗ No connection between objectives and deliverables

### 1.3 Scope of Work
Must include:
- All tasks and activities to be performed
- Clear, action-oriented language
- Complex tasks broken into smaller components
- Specific quantities, frequencies, and formats
- Methodology or approach at appropriate detail level

FLAGS:
✗ Tasks described in vague terms
✗ No quantification of effort or output
✗ Scope that could have multiple interpretations
✗ Missing activities required to achieve stated objectives

### 1.4 Out of Scope and Exclusions (CRITICAL)
This section PREVENTS SCOPE CREEP. Must explicitly list:
- Services, deliverables, or activities NOT included
- Adjacent services clients commonly assume are included
- Specific enough to prevent misunderstanding

Common items to consider for exclusions:
- Rush fees and expedited timelines
- Additional revision rounds beyond stated limits
- Crisis communications support
- Paid media spend and management
- Event staffing or on-site support
- Travel outside defined geography
- Third-party vendor management
- Photography, video production, content creation
- Translation or localization
- Legal review of materials
- Regulatory compliance verification

FLAGS:
✗ Missing exclusions section entirely
✗ Exclusions too vague to be useful
✗ Common adjacent services not addressed

### 1.5 Deliverables
Each deliverable MUST include:
- Clear description of what will be produced
- Format and specifications
- Quantity or volume (use "1x" notation)
- Quality standards or requirements
- Dependencies on client inputs

FLAGS:
✗ Deliverables without format or specifications
✗ No stated quantity or volume limits
✗ Deliverables depending on client inputs without those inputs specified
✗ Vague descriptions that could encompass varying effort levels

### 1.6 Acceptance Criteria
For each major deliverable, define:
- Specific conditions for acceptance
- Who has authority to approve
- Timeframe for client review
- Process if deliverable does not meet criteria
- Deemed acceptance provision for client non-response

Acceptance criteria MUST be:
- Objective and measurable
- Agreed upon before work begins
- Clear about what constitutes completion

FLAGS:
✗ No acceptance criteria defined
✗ Subjective criteria that invite dispute
✗ No review window specified
✗ No deemed acceptance provision
✗ No process for rejected deliverables

### 1.7 Timeline and Milestones
Must include:
- Realistic schedule with clear deadlines
- Major milestones with target dates
- Dependencies between tasks
- Client review and approval cycles
- Critical path items

FLAGS:
✗ No specific dates or timeframes
✗ Timeline not accounting for client review periods
✗ Dependencies not identified
✗ Milestones not tied to specific deliverables
✗ No buffer for client delays or revisions

### 1.8 Roles and Responsibilities

AGENCY responsibilities:
- Specific tasks agency will perform
- Resources agency will provide
- Communication and reporting cadence
- Project management approach

CLIENT responsibilities (CRITICAL):
- Materials, content, or assets client must provide
- Access to systems, personnel, or information
- Response and approval timeframes
- Feedback consolidation requirements
- Decision-making authority and designated approvers

FLAGS:
✗ Client responsibilities missing or vague
✗ No specified response timeframes for client
✗ No designated approver identified
✗ No consequences for client failure to meet responsibilities
✗ Feedback consolidation not addressed

### 1.8.1 Engagement Operating Model / Ways of Working (RECOMMENDED)
Defines how Agency and Client will work together operationally. Should include:
- Governance structure: review cadences, steering meetings, reporting rhythm
- Communication approach: status update frequency, format, and participants
- Approval and decision-making workflow: who approves what, turnaround expectations
- Meeting cadence: kickoff, working sessions, strategic reviews
- This section should be tailored to the client relationship style, not boilerplate

Note: Presence of this section is a quality indicator, not a hard requirement. However, SOWs that define ways of working upfront experience fewer process disputes.

FLAGS:
⚠ No governance or communication cadence defined
⚠ Approval workflow unclear or undefined
⚠ Meeting cadence not specified

### 1.9 Assumptions
Document conditions expected to exist. Common assumptions include:
- Client cooperation and responsiveness
- Access to required systems or information
- Availability of client personnel
- Accuracy of information provided by client
- Third-party performance or availability
- Technical environment stability
- Regulatory environment stability

Each assumption MUST have:
- Clear statement of what is assumed
- Consequence or contingency if assumption proves false

FLAGS:
✗ No assumptions section
✗ Assumptions without consequences for failure
✗ Critical dependencies not identified as assumptions
✗ Response time assumptions missing
✗ No provision for adjusting scope, timeline, or fee if assumptions fail

### 1.10 Change Management Process
Must define:
- How changes are requested
- Who can authorize changes
- How impact to timeline and budget is assessed
- Documentation requirements
- Process for approving and implementing changes

FLAGS:
✗ No change management process defined
✗ No requirement for written approval before work proceeds
✗ No provision for impact assessment
✗ Unclear authorization requirements

### 1.11 Fees and Payment Terms
Must specify:
- Total fee or fee structure
- Payment schedule and milestones
- Invoice timing and payment terms
- Late payment consequences
- Rate schedule for out-of-scope work
- Expense handling and approval thresholds

FLAGS:
✗ Fee not clearly stated
✗ Payment not tied to milestones or deliverables
✗ No late payment provisions
✗ No rate for additional work
✗ Expense handling unclear

### 1.12 Termination Provisions
Must address:
- Termination for cause (material breach)
- Termination for convenience
- Notice requirements
- Payment obligations upon termination
- Kill fee or early termination fee if applicable
- Transition obligations

FLAGS:
✗ No termination provisions
✗ No notice period specified
✗ Payment upon termination unclear
✗ No protection for agency if client terminates early

---

## PART 2: LANGUAGE QUALITY STANDARDS

### 2.1 VAGUE QUALIFIERS TO FLAG (Replace with specific language)
- "Approximately" or "about" → specify tolerance range
- "Reasonable" → define specifically
- "As needed" or "as appropriate" → add parameters with "up to" caps
- "Best efforts" → define measurable standard
- "Standard" or "typical" → specify what standard means
- "Ongoing" → add time boundary (e.g., "for up to 12 months")
- "Regular" → specify frequency (e.g., "up to 2 times per week")
- "Timely" → specify timeframe (e.g., "within 5 business days")
- "Various" or "multiple" → specify exact number
- "Etc." or "and so on" → enumerate all items
- "Including but not limited to" → enumerate specific items

### 2.2 PROBLEMATIC SCOPE LANGUAGE TO FLAG
- "Support" → define specific activities
- "Assistance" → define specific activities
- "Management" → define specific activities
- "Oversight" → define specific activities
- "Coordination" → define specific activities
- "Consultation" → define format, frequency, limits (e.g., "up to 4 hours per month")
- "Guidance" → define format or limits
- "Strategy" → define specific deliverables

### 2.3 UNLIMITED/OPEN-ENDED COMMITMENTS TO FLAG (CRITICAL)
These MUST be replaced with bounded language:
- "Unlimited revisions" → "Up to [X] rounds of revisions"
- "As many as needed" → "Up to [X]"
- "Until client is satisfied" → objective completion criteria
- "Ongoing support" → bounded term with hour cap
- "Continuous improvement" → defined iterations
- "Ad hoc" → "Up to [X] hours per month"
- "As and when" → specify triggers with caps
- Any commitment without stated limits

### 2.4 PASSIVE VOICE OBSCURING RESPONSIBILITY
Flag and recommend active voice:
- "Work will be completed" → "Agency will complete..."
- "Deliverables will be provided" → "Agency will deliver..."
- "Feedback will be incorporated" → "Agency will incorporate up to [X] rounds..."
- "Approval will be obtained" → "Client will approve within [X] business days..."

### 2.5 RECOMMENDED LANGUAGE PATTERNS

CONTROLLED QUANTIFICATION (use "up to" language):
- "Up to X hours of consultation"
- "Up to X rounds of revisions"
- "Up to X deliverables per month"
- "Up to X proactive media pitches"

Benefits of "up to" language:
- Sets ceiling client cannot exceed without additional fees
- Does not commit agency to minimum if circumstances change
- Creates natural conversation point when approaching limits
- Provides no discount for unused capacity (it is reserved, not delivered)

SPECIFIC TIMEFRAMES:
- "Within X business days of [trigger event]"
- "By [specific date]"
- "No later than X days before [milestone]"
- "Weekly, delivered every [day] by [time]"

CLEAR RESPONSIBILITY ASSIGNMENT:
- "Agency will deliver..."
- "Client will provide..."
- "Client's designated approver will respond..."

CONDITIONAL LANGUAGE FOR DEPENDENCIES:
- "Agency will deliver X, contingent upon receiving Y from Client by [date]"
- "Timeline assumes Client provides Z within [timeframe]; delays may require schedule adjustment"

REVISION LIMITS PATTERN:
"This scope includes up to [number] rounds of revisions of decreasing complexity. A round of revisions consists of one consolidated set of feedback from Client's designated approver. Additional revision rounds beyond those included will be billed at [rate] per round or quoted separately."

CONSOLIDATED FEEDBACK PATTERN:
"Client will consolidate all stakeholder feedback into a single submission per revision round. Multiple separate feedback submissions addressing the same deliverable will each count as a separate revision round."

---

## PART 3: CLIENT RESPONSIBILITIES (MUST be present)

### 3.1 Consolidated Feedback Requirement
MUST include language similar to: "Client agrees to consolidate all internal feedback before submission to Agency. Feedback must represent unified organizational direction; Agency is not responsible for reconciling conflicting stakeholder input."

### 3.2 Approval Windows
MUST specify: "Client commits to providing feedback within [X] business days of deliverable submission. Deliverables not rejected within this window shall be deemed approved."

### 3.3 Change Control
MUST include: "Any change to scope, timeline, or budget requires mutual written agreement via change order. Agency may decline changes that compromise quality or timeline."

### 3.4 Stakeholder Protection
Include language: "Agency will interface with a maximum of [X] client stakeholders for feedback purposes. Additional stakeholders require scope adjustment."

### 3.5 Client Obligations with Consequences
Each client obligation should include:
- Specific action required
- Timeframe for completion
- Consequence for failure

Pattern: "Client will [specific action] within [timeframe] of [trigger event]. If Client fails to meet this obligation, Agency may [consequence: adjust timeline, pause work, adjust fee, etc.]."

---

## PART 4: CONTRACT TYPE SPECIFIC REQUIREMENTS

### 4.1 Fixed Fee Contracts
REQUIRED ELEMENTS:
□ Scope exhaustively defined (all deliverables with specifications)
□ Quantities and volumes specified
□ Revision rounds specified and limited
□ Meeting and consultation time limited
□ Exclusions clearly stated
□ Assumptions documented with consequences
□ Change order process requiring written approval
□ Client obligations with timeframes and consequences
□ Completion clearly defined with acceptance criteria
□ Deemed acceptance provision

HIGH RISK INDICATORS:
✗ Unlimited revision language
✗ Scope in vague terms
✗ No exclusions section
✗ No assumptions documented
✗ Client obligations without consequences
✗ No change order process
✗ Completion tied to subjective client satisfaction

### 4.2 Time & Materials Contracts
REQUIRED ELEMENTS:
□ Rate schedule complete (all roles, billing increment, adjustment provisions)
□ Initial estimate provided (clearly stated as estimate, not cap)
□ Notification thresholds when approaching estimate
□ Tracking increment specified
□ Reporting frequency and content defined
□ Client access to detailed time logs
□ Scope guidance (intended objectives and boundaries)

RISK INDICATORS:
✗ No estimate provided
✗ No notification thresholds
✗ Vague or no reporting requirements
✗ No billing increment specified
✗ No scope guidance or boundaries

### 4.3 Time & Materials with Cap (Not to Exceed)
REQUIRED ELEMENTS:
□ Cap clearly defined (total amount, inclusions, exclusions)
□ Cap explicitly tied to defined scope
□ Notification thresholds (percentage trigger)
□ Work stoppage rights when cap approached
□ Scope change provisions requiring cap adjustment
□ Assumption protection (failure grounds for cap adjustment)
□ No obligation to work beyond cap without authorization

HIGH RISK INDICATORS:
✗ Cap not tied to specific scope
✗ No notification thresholds
✗ No work stoppage provision
✗ No scope change adjustment mechanism
✗ Assumptions not documented or protected
✗ Cap includes pass-through costs agency cannot control

### 4.4 Retainer Contracts

IMPORTANT: Retainers can be structured two ways - understand the difference:

**Deposit-Based Minimum Commitment Model:**
- Client pays minimum commitment upfront as deposit
- Work is drawn down against deposit with approval process
- Client can exceed deposit and pay additional T&M
- This is a FLOOR (minimum spend), NOT a ceiling
- DO NOT flag deposit language as needing "up to" caps
- DO NOT suggest rollover policies for deposit models - they work differently

**Traditional Hourly/Monthly Allocation Model:**
- Client gets fixed allocation per period
- Unused time may or may not roll over
- Overages billed at specified rates

REQUIRED ELEMENTS (all retainer types):
□ Minimum term specified
□ Fee structure clearly stated (deposit vs monthly)
□ Early termination provisions and fees
□ Services included clearly enumerated
□ Services explicitly excluded
□ Overage handling defined (rate, notification, pre-approval)
□ Notice period for non-renewal

ADDITIONAL FOR TRADITIONAL ALLOCATION MODEL:
□ Monthly allocation specified
□ Rollover policy clearly stated (recommend: limited or no rollover)
□ Utilization tracking and reporting

ADDITIONAL FOR DEPOSIT-BASED MODEL:
□ Minimum commitment amount stated
□ Deposit payment terms
□ Drawdown approval process
□ Request parameters (min/max per request)
□ Service level commitments

ROLLOVER POLICY OPTIONS (Traditional Model Only):
- Option A (Recommended): No rollover - unused allocation forfeited
- Option B: Limited rollover to immediately following month only, with cap
- Option C: No monthly rollover with quarterly true-up review

RISK INDICATORS:
✗ No minimum term commitment
✗ Unlimited rollover (traditional model)
✗ Vague scope definition
✗ No overage mechanism
✗ No utilization reporting (traditional model)
✗ No early termination protection
✗ Discount without corresponding commitment

---

## PART 5: SERVICE-LINE SPECIFIC REQUIREMENTS

### 5.1 Branding Projects
□ Brand architecture/hierarchy explicitly addressed
□ Stakeholder alignment sessions defined
□ Number of concepts at each stage specified
□ Revision rounds per phase specified
□ Asset formats and file deliverables listed (file formats, sizes)
□ Guidelines scope (what's covered, what's not)
□ Usage rights and licensing terms
□ Photography and stock imagery handling

### 5.2 Website Projects
□ Technical requirements (CMS, hosting, etc.)
□ Content responsibility clearly assigned
□ Browser/device compatibility defined
□ Page counts specified
□ Post-launch support period specified
□ Training deliverables included
□ UAT (User Acceptance Testing) process defined
□ Warranty period specified
□ Third-party integrations listed

### 5.3 PR/Communications
□ Media target list scope defined
□ Number of proactive pitches per period specified
□ Reporting frequency and format defined
□ Measurement metrics specified
□ Reactive media inquiry handling (included or excluded)
□ Spokesperson preparation (included or excluded)
□ Message development ownership
□ Crisis communications (typically excluded unless explicit)

### 5.4 Creative Retainers

IMPORTANT: Creative retainers can follow two models. DO NOT confuse them:

**Model A: Deposit-Based Minimum Commitment (e.g., Integrated Creative & Strategic Support Retainer)**
- Client pays a MINIMUM annual commitment upfront as a deposit
- Deposit is drawn down against approved work throughout the term
- Client CAN SPEND MORE than the deposit on a T&M basis
- This is NOT a cap - it's a FLOOR
- DO NOT suggest "up to" language for deposit amounts - the deposit IS the minimum, not the maximum
- DO NOT suggest "unused budget does not roll over" - deposits are meant to be used
- Key language pattern: "minimum annual commitment of $X... held as a deposit and drawn down"

Required elements for deposit-based retainers:
□ Minimum commitment amount clearly stated
□ Deposit payment terms specified
□ Drawdown/approval process for individual requests
□ T&M rates for work exceeding deposit
□ Request parameters (minimum charge, maximum per request before separate SOW)
□ Service hours and availability
□ Service level commitments (response times, delivery windows)
□ Expedited turnaround process
□ Services included and excluded

**Model B: Traditional Hourly Allocation Retainer**
□ Monthly hour allocation clearly stated
□ Rollover policy defined (recommend: limited or no rollover)
□ Utilization reporting specified
□ Rate card for overage included
□ Request parameters (lead times, formats)
□ SLAs for response times
□ Exclusions clearly listed

### 5.5 Paid Media
□ Separation of media spend from agency fees
□ Media spend ownership and management
□ Ad account ownership
□ Reporting frequency and format
□ Optimization responsibilities and frequency
□ Platform-specific requirements
□ Audience development and targeting scope

### 5.6 Integrated/Multi-Service
□ Workstream dependencies mapped
□ Cross-functional coordination specified
□ Boundaries between service lines defined
□ Handoff points between teams identified
□ Which team leads on strategy vs execution
□ Consolidated vs separate reporting
□ Single point of contact vs multiple
□ Integrated timeline with milestones
□ Single point of accountability identified

---

## PART 6: SCOPE CREEP PREVENTION CHECKLIST

### 6.1 Does the SOW include these protection mechanisms?
□ Explicit exclusions section
□ Client obligations with documented consequences
□ Revision limits with process for additional rounds
□ Consolidated feedback requirement
□ Assumptions documentation with adjustment provisions
□ Formal change order process
□ Stop work provisions for client non-compliance

### 6.2 Stop Work / Pause Clause
Should include:
- Trigger events (payment default, failure to respond, failure to provide inputs)
- Grace period before pause takes effect
- Notification requirements
- Impact on timeline
- Restart conditions and potential restart fee
- Relationship to termination rights

Pattern: "If Client fails to make a payment when due, or fails to respond to requests within [specified period], Agency may stop work upon written notice until Client cures the failure. Client acknowledges that stopping work will cause delay, and timeline will be adjusted accordingly. If Agency stops work for more than [period], Agency may require a restart fee before resuming."

---

## PART 7: QUICK REFERENCE - REVIEW FLAGS

### FLAG AS HIGH PRIORITY (Must fix before issuing):
Missing Elements:
- No exclusions section
- No client obligations
- No revision limits
- No change order process
- No assumptions documentation
- No acceptance criteria

Problematic Language:
- "Unlimited" anything
- "As needed" without parameters
- "Reasonable" without definition
- Any commitment without limits

Structural Issues:
- Payment not tied to milestones or deliverables
- No consequences for client non-performance
- No termination protection
- Scope not aligned with pricing model

### FLAG AS MODERATE PRIORITY (Should fix):
Missing Elements:
- Incomplete acceptance criteria
- Vague timeline
- Unclear roles
- Missing reporting requirements

Language Issues:
- Passive voice obscuring responsibility
- Vague qualifiers
- Undefined terms
- Inconsistent terminology

### FLAG FOR IMPROVEMENT (Would strengthen):
- Could be more specific
- Could benefit from examples
- Terms could be defined
- Could add flexibility mechanisms
- Could strengthen protections
`;

// ============================================================================
// COMPONENTS
// ============================================================================

// Antenna-style Button with yellow highlight that slides away on hover
function AntennaButton({ children, onClick, disabled, loading, loadingText, icon: Icon, className = "", variant = "primary", size = "default" }) {
  const baseStyles = "group relative overflow-hidden font-semibold transition-all duration-300 flex items-center justify-center";
  
  const variants = {
    primary: "bg-[#12161E] text-white",
    secondary: "bg-white text-[#12161E] border-2 border-[#12161E]",
    ghost: "bg-transparent text-[#12161E] hover:bg-[#12161E]/5"
  };
  
  const sizes = {
    small: "px-4 py-2 text-sm rounded-lg gap-2",
    default: "px-6 py-3 text-base rounded-xl gap-3",
    large: "px-8 py-4 text-lg rounded-xl gap-3"
  };
  
  const disabledStyles = disabled || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer";
  
  // Lime yellow color from Antenna brand
  const highlightColor = "#E8FF00";
  
  // Determine text colors based on variant
  const isLightBg = variant === 'secondary' || variant === 'ghost';
  const baseTextColor = isLightBg ? '#12161E' : 'white';
  const highlightTextColor = '#12161E'; // Always black on yellow
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabledStyles} ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin relative z-10" />
          <span className="relative z-10">{loadingText || 'Loading...'}</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-5 h-5 relative z-10 flex-shrink-0" />}
          
          {/* Text container with yellow highlight that slides down on hover */}
          <span className="relative z-10 flex-shrink-0 overflow-hidden">
            {/* Base text (revealed on hover) */}
            <span className="relative inline-block" style={{ color: baseTextColor }}>
              {children}
              {/* Yellow highlight with black text on top - slides down on hover */}
              <span 
                className="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out group-hover:translate-y-full pointer-events-none"
                style={{ backgroundColor: highlightColor }}
              >
                <span style={{ color: highlightTextColor }}>{children}</span>
              </span>
            </span>
          </span>
          
          {/* Arrow */}
          <svg 
            className="w-5 h-5 flex-shrink-0 relative z-10" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17L17 7M17 7H7M17 7V17" />
          </svg>
        </>
      )}
    </button>
  );
}

// Antenna Group Logo
function AntennaLogo({ className = "h-8" }) {
  return (
    <img 
      src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" 
      alt="Antenna Group" 
      className={className}
    />
  );
}

// Collapsible Section
function CollapsibleSection({ title, children, defaultOpen = false, icon: Icon, count, variant }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const variants = {
    critical: { header: 'bg-red-50 hover:bg-red-100', badge: 'bg-red-600 text-white', icon: 'text-red-600' },
    recommended: { header: 'bg-amber-50 hover:bg-amber-100', badge: 'bg-amber-600 text-white', icon: 'text-amber-600' },
    default: { header: 'bg-gray-50 hover:bg-gray-100', badge: 'bg-gray-900 text-white', icon: 'text-gray-900' }
  };
  
  const style = variants[variant] || variants.default;
  
  return (
    <div className="border border-gray-200 rounded-xl mb-3 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-5 py-4 ${style.header} flex items-center justify-between transition-colors`}
      >
        <div className="flex items-center gap-3">
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-900" /> : <ChevronRight className="w-4 h-4 text-gray-900" />}
          {Icon && <Icon className={`w-5 h-5 ${style.icon}`} />}
          <span className="font-semibold text-gray-900">{title}</span>
          {count !== undefined && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.badge}`}>
              {count}
            </span>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="p-5 bg-white border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// Copy Button
function CopyButton({ text, className = "" }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-md transition-all ${
        copied 
          ? 'bg-green-600 text-white' 
          : 'bg-white/60 text-gray-500 hover:bg-white hover:text-gray-900'
      } ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// Issue Card for Review
function IssueCard({ issue, type, isSelected, onToggle }) {
  const styles = {
    critical: { bg: 'bg-red-50 border-red-200', icon: 'text-red-600', Icon: AlertCircle },
    recommended: { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', Icon: AlertTriangle },
    info: { bg: 'bg-gray-50 border-gray-200', icon: 'text-gray-900', Icon: CheckCircle }
  };
  
  const { bg, icon, Icon } = styles[type] || styles.info;
  
  // Adjust background when deselected
  const cardBg = isSelected === false ? 'bg-gray-100 border-gray-200 opacity-60' : bg;

  const parseIssue = (text) => {
    const result = { 
      section: null, 
      currentLanguage: null, 
      recommendation: null,
      missingElement: null,
      addLanguage: null,
      why: null,
      issueType: null,
      title: null
    };
    
    // Clean up markdown formatting
    let cleanText = text.replace(/\*\*/g, ''); // Remove bold markers
    
    // Extract section - handle various formats like "Section D.2.2:" or "**Section D.2.2:**"
    const sectionMatch = cleanText.match(/(?:Section|§)\s*([\d.A-Za-z]+)/i);
    if (sectionMatch) result.section = sectionMatch[1];
    
    // Extract title (text after section number, before Current/Missing)
    const titleMatch = cleanText.match(/Section\s*[\d.A-Za-z]+[:\s]*([^\n]+?)(?=\n|Current:|Missing:|$)/i);
    if (titleMatch) result.title = titleMatch[1].trim();
    
    // Check for "Missing" format (Type B - missing elements)
    const missingMatch = cleanText.match(/Missing:\s*[""]?([^""\n]+)[""]?/i);
    const addMatch = cleanText.match(/Add:\s*[""]([^""]+)[""]|Add:\s*"([^"]+)"/i);
    
    if (missingMatch || addMatch) {
      result.issueType = 'missing';
      if (missingMatch) result.missingElement = missingMatch[1].trim();
      if (addMatch) result.addLanguage = (addMatch[1] || addMatch[2]).trim();
    }
    
    // Check for "Current/Recommended" format (Type A - language issues)
    // Handle both quoted and unquoted, multiline content
    const currentMatch = cleanText.match(/Current:\s*[""]([^""]+)[""]|Current:\s*"([^"]+)"/i);
    const recommendedMatch = cleanText.match(/Recommended:\s*[""]([^""]+)[""]|Recommended:\s*"([^"]+)"/i);
    
    if (currentMatch && recommendedMatch) {
      result.issueType = 'language';
      result.currentLanguage = (currentMatch[1] || currentMatch[2]).trim();
      result.recommendation = (recommendedMatch[1] || recommendedMatch[2]).trim();
    }
    
    // Fallback: arrow format
    const arrowMatch = cleanText.match(/[""]([^""]+)[""]\s*[→→>-]+\s*[""]([^""]+)[""]/);
    if (arrowMatch && !result.issueType) {
      result.issueType = 'language';
      result.currentLanguage = arrowMatch[1].trim();
      result.recommendation = arrowMatch[2].trim();
    }
    
    // Extract "Why" explanation
    const whyMatch = cleanText.match(/Why:\s*([^\n]+)/i);
    if (whyMatch) result.why = whyMatch[1].trim();
    
    return result;
  };

  const parsed = parseIssue(issue);
  
  // Get the issue description/title
  const getIssueDescription = () => {
    if (parsed.title) return parsed.title;
    
    let desc = issue.replace(/\*\*/g, ''); // Remove bold
    // Remove the structured parts to get just the description
    desc = desc.replace(/Current:[\s\S]*?(?=Recommended:|Missing:|Add:|Why:|$)/i, '');
    desc = desc.replace(/Recommended:[\s\S]*?(?=Why:|$)/i, '');
    desc = desc.replace(/Missing:[\s\S]*?(?=Add:|Why:|$)/i, '');
    desc = desc.replace(/Add:[\s\S]*?(?=Why:|$)/i, '');
    desc = desc.replace(/Why:[\s\S]*$/i, '');
    desc = desc.replace(/Section[:\s]*[\d.A-Za-z]+[:\s]*/i, '').trim();
    // Clean up and get first meaningful line
    const lines = desc.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return lines[0] || '';
  };

  return (
    <div className={`p-4 rounded-xl border ${cardBg} mb-3 transition-all`}>
      <div className="flex items-start gap-3">
        {onToggle && (
          <label className="flex items-center cursor-pointer mt-0.5">
            <input
              type="checkbox"
              checked={isSelected !== false}
              onChange={onToggle}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
            />
          </label>
        )}
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${icon}`} />
        <div className="w-full">
          {parsed.section && (
            <span className="inline-block text-xs font-mono bg-white/60 px-2 py-0.5 rounded mb-2 text-gray-500">
              Section {parsed.section}
            </span>
          )}
          
          {parsed.issueType === 'language' && parsed.currentLanguage && parsed.recommendation ? (
            // Type A: Language issue with Current → Recommended
            <div className="space-y-3">
              <p className="text-sm text-gray-900 leading-relaxed font-medium">
                {getIssueDescription()}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-white/50 rounded-lg p-3 border border-red-200">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Current</p>
                  <p className="text-sm text-gray-900 font-mono leading-relaxed">"{parsed.currentLanguage}"</p>
                </div>
                <div className="bg-white/50 rounded-lg p-3 border border-green-200 relative">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Recommended</p>
                    <CopyButton text={parsed.recommendation} />
                  </div>
                  <p className="text-sm text-gray-900 font-mono leading-relaxed">"{parsed.recommendation}"</p>
                </div>
              </div>
              {parsed.why && (
                <p className="text-xs text-gray-500 italic">{parsed.why}</p>
              )}
            </div>
          ) : parsed.issueType === 'missing' && (parsed.missingElement || parsed.addLanguage) ? (
            // Type B: Missing element - show what to add
            <div className="space-y-3">
              <p className="text-sm text-gray-900 leading-relaxed font-medium">
                {parsed.missingElement ? `Missing: ${parsed.missingElement}` : getIssueDescription()}
              </p>
              {parsed.addLanguage && (
                <div className="bg-white/50 rounded-lg p-3 border border-green-200 relative">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Add This Language</p>
                    <CopyButton text={parsed.addLanguage} />
                  </div>
                  <p className="text-sm text-gray-900 font-mono leading-relaxed">"{parsed.addLanguage}"</p>
                </div>
              )}
              {parsed.why && (
                <p className="text-xs text-gray-500 italic">{parsed.why}</p>
              )}
            </div>
          ) : (
            // Fallback: just show the raw text
            <div className="text-sm whitespace-pre-wrap text-gray-900 leading-relaxed">{issue}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Red Flag Card
function RedFlagCard({ flag, isSelected, onToggle }) {
  const parseRedFlag = (text) => {
    const arrowMatch = text.match(/[""]([^""]+)[""]\s*(?:in\s+)?(?:Section\s+)?([\d.]*)\s*[→→>-]+\s*[""]([^""]+)[""]/i);
    if (arrowMatch) {
      return { found: arrowMatch[1].trim(), section: arrowMatch[2] || null, replacement: arrowMatch[3].trim() };
    }
    const simpleArrow = text.match(/[""]([^""]+)[""]\s*[→→>-]+\s*[""]([^""]+)[""]/);
    if (simpleArrow) {
      const sectionMatch = text.match(/Section\s+([\d.]+)/i);
      return { found: simpleArrow[1].trim(), section: sectionMatch ? sectionMatch[1] : null, replacement: simpleArrow[2].trim() };
    }
    return null;
  };

  const parsed = parseRedFlag(flag);
  const cardBg = isSelected === false ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-gray-50 border-gray-200';

  if (parsed) {
    return (
      <div className={`${cardBg} rounded-xl p-4 mb-3 transition-all`}>
        <div className="flex items-start gap-3">
          {onToggle && (
            <label className="flex items-center cursor-pointer mt-0.5">
              <input
                type="checkbox"
                checked={isSelected !== false}
                onChange={onToggle}
                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
              />
            </label>
          )}
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
          <div className="w-full">
            {parsed.section && (
              <span className="inline-block text-xs font-mono bg-white/60 px-2 py-0.5 rounded mb-2 text-gray-500">
                Section {parsed.section}
              </span>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                <span className="text-xs text-red-600 font-medium">Found:</span>
                <span className="text-sm font-mono text-gray-900">"{parsed.found}"</span>
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <span className="inline-flex items-center gap-1 bg-white border border-green-200 px-3 py-1.5 rounded-lg">
                <span className="text-xs text-green-600 font-medium">Replace:</span>
                <span className="text-sm font-mono text-gray-900">"{parsed.replacement}"</span>
                <CopyButton text={parsed.replacement} className="ml-1" />
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardBg} rounded-xl p-4 mb-3 transition-all`}>
      <div className="flex items-start gap-3">
        {onToggle && (
          <label className="flex items-center cursor-pointer mt-0.5">
            <input
              type="checkbox"
              checked={isSelected !== false}
              onChange={onToggle}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
            />
          </label>
        )}
        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
        <div className="text-sm whitespace-pre-wrap text-gray-900 leading-relaxed">{flag}</div>
      </div>
    </div>
  );
}

// API Key Input
function ApiKeyInput({ apiKey, setApiKey }) {
  const [showKey, setShowKey] = useState(false);
  
  return (
    <div className="mb-8">
      <label className="block text-sm font-semibold text-gray-900 mb-2">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4" />
          Anthropic API Key
        </div>
      </label>
      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-api03-..."
          className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-900 placeholder:text-gray-400"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors"
        >
          {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Your API key is only used in your browser and never stored.
        Get one at <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-gray-900 underline hover:no-underline">console.anthropic.com</a>
      </p>
    </div>
  );
}

// Service Selection Card
// Helper function to format pricing guidance
const formatPricingGuidance = (service) => {
  if (!service.pricing) return null;
  
  const pricing = service.pricing;
  
  // Handle percentage-based pricing (Project Management)
  if (pricing.percentageOfProject) {
    return {
      term: null,
      budget: `~${pricing.percentageOfProject}% of project`,
      note: pricing.note,
      bundle: null
    };
  }
  
  // Handle percentage-of-paid-media pricing (Marketing Operations)
  if (pricing.percentageOfPaidMedia) {
    return {
      term: null,
      budget: `~${pricing.percentageOfPaidMedia}% of paid media fees`,
      note: pricing.note,
      bundle: null
    };
  }
  
  // Handle bundled services (only first in bundle shows pricing)
  if (pricing.bundle && !pricing.termLow) {
    return {
      term: null,
      budget: null,
      note: null,
      bundle: pricing.bundle
    };
  }
  
  // Format term
  let term = null;
  if (pricing.termLow && pricing.termHigh) {
    if (pricing.termLow === pricing.termHigh) {
      term = pricing.termLow === 52 ? 'Annual' : `${pricing.termLow} weeks`;
    } else {
      term = `${pricing.termLow}-${pricing.termHigh} weeks`;
    }
  }
  
  // Format budget
  let budget = null;
  if (pricing.budgetLow && pricing.budgetHigh) {
    const formatCurrency = (num) => {
      if (num >= 1000) return `$${(num/1000).toFixed(0)}K`;
      return `$${num}`;
    };
    if (pricing.budgetLow === pricing.budgetHigh) {
      budget = formatCurrency(pricing.budgetLow);
    } else {
      budget = `${formatCurrency(pricing.budgetLow)}-${formatCurrency(pricing.budgetHigh)}`;
    }
  }
  
  return {
    term,
    budget,
    note: pricing.note,
    bundle: pricing.bundle
  };
};

// Categories whose fees count as "paid media" for Marketing Operations percentage calculation
const PAID_MEDIA_CATEGORY_IDS = ['paid_media'];

// Helper function to calculate total pricing range for selected services
const calculatePricingTotal = (selectedServices) => {
  let totalLow = 0;
  let totalHigh = 0;
  let paidMediaLow = 0;
  let paidMediaHigh = 0;
  const countedBundles = new Set();
  let pmPercentageCount = 0;
  let mktOpsPercentage = 0;
  let hasUncountable = false;

  for (const trigger of SERVICE_TRIGGERS) {
    const isPaidMediaCategory = PAID_MEDIA_CATEGORY_IDS.includes(trigger.id);
    
    for (const service of trigger.services) {
      const name = typeof service === 'object' ? service.name : service;
      if (!selectedServices.includes(name)) continue;
      if (!service.pricing) continue;

      const pricing = service.pricing;

      // Project Management is percentage-based, count selections
      if (pricing.percentageOfProject) {
        pmPercentageCount++;
        continue;
      }

      // Marketing Operations is percentage-of-paid-media
      if (pricing.percentageOfPaidMedia) {
        mktOpsPercentage = pricing.percentageOfPaidMedia;
        continue;
      }

      // Bundled service without its own pricing (included in bundle lead)
      if (pricing.bundle && !pricing.budgetLow) {
        if (!countedBundles.has(pricing.bundle)) {
          hasUncountable = true;
        }
        continue;
      }

      // Bundle lead service or standalone service with pricing
      if (pricing.bundle) {
        if (countedBundles.has(pricing.bundle)) continue;
        countedBundles.add(pricing.bundle);
      }

      if (pricing.budgetLow) totalLow += pricing.budgetLow;
      if (pricing.budgetHigh) totalHigh += pricing.budgetHigh;
      
      // Track paid media subtotal separately
      if (isPaidMediaCategory) {
        if (pricing.budgetLow) paidMediaLow += pricing.budgetLow;
        if (pricing.budgetHigh) paidMediaHigh += pricing.budgetHigh;
      }
    }
  }

  if (totalLow === 0 && totalHigh === 0 && pmPercentageCount === 0 && mktOpsPercentage === 0) return null;

  // Calculate PM addition (10% applied once regardless of how many PM services selected)
  let pmLow = 0;
  let pmHigh = 0;
  if (pmPercentageCount > 0 && totalLow > 0) {
    pmLow = Math.round(totalLow * 0.10);
    pmHigh = Math.round(totalHigh * 0.10);
  }

  // Calculate Marketing Operations addition (percentage of paid media fees)
  let mktOpsLow = 0;
  let mktOpsHigh = 0;
  if (mktOpsPercentage > 0 && paidMediaLow > 0) {
    mktOpsLow = Math.round(paidMediaLow * (mktOpsPercentage / 100));
    mktOpsHigh = Math.round(paidMediaHigh * (mktOpsPercentage / 100));
  }

  const grandLow = totalLow + pmLow + mktOpsLow;
  const grandHigh = totalHigh + pmHigh + mktOpsHigh;

  const formatCurrency = (num) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num}`;
  };

  return {
    subtotalLow: totalLow,
    subtotalHigh: totalHigh,
    low: grandLow,
    high: grandHigh,
    lowFormatted: formatCurrency(grandLow),
    highFormatted: formatCurrency(grandHigh),
    subtotalLowFormatted: formatCurrency(totalLow),
    subtotalHighFormatted: formatCurrency(totalHigh),
    pmLow, pmHigh,
    pmLowFormatted: formatCurrency(pmLow),
    pmHighFormatted: formatCurrency(pmHigh),
    hasPM: pmPercentageCount > 0 && totalLow > 0,
    hasPMNoBase: pmPercentageCount > 0 && totalLow === 0,
    mktOpsLow, mktOpsHigh,
    mktOpsLowFormatted: formatCurrency(mktOpsLow),
    mktOpsHighFormatted: formatCurrency(mktOpsHigh),
    hasMktOps: mktOpsPercentage > 0 && paidMediaLow > 0,
    hasMktOpsNoPaidMedia: mktOpsPercentage > 0 && paidMediaLow === 0,
    mktOpsPercentage,
    hasUncountable
  };
};

// Pricing total summary bar component
function PricingTotalBar({ selectedServices }) {
  const pricingTotal = calculatePricingTotal(selectedServices);
  if (!pricingTotal) return null;
  
  const hasBreakdown = (pricingTotal.hasPM || pricingTotal.hasMktOps) && pricingTotal.subtotalLow > 0;
  
  return (
    <div className="mb-4 p-3 bg-gray-100 rounded-lg border border-gray-200">
      {/* Subtotal line (show if PM or MktOps adds to the total) */}
      {hasBreakdown && (
        <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
          <span>Services</span>
          <span>{pricingTotal.subtotalLowFormatted} – {pricingTotal.subtotalHighFormatted}</span>
        </div>
      )}
      {pricingTotal.hasPM && (
        <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
          <span>Project Management (~10%)</span>
          <span>{pricingTotal.pmLowFormatted} – {pricingTotal.pmHighFormatted}</span>
        </div>
      )}
      {pricingTotal.hasMktOps && (
        <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
          <span>Marketing Operations (~{pricingTotal.mktOpsPercentage}% of paid media)</span>
          <span>{pricingTotal.mktOpsLowFormatted} – {pricingTotal.mktOpsHighFormatted}</span>
        </div>
      )}
      {hasBreakdown && (
        <div className="border-t border-gray-300 my-1" />
      )}
      {/* Grand total */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Estimated Range</span>
        <span className="text-lg font-bold text-gray-900">
          {pricingTotal.lowFormatted} – {pricingTotal.highFormatted}
        </span>
      </div>
      {(pricingTotal.hasPMNoBase || pricingTotal.hasMktOpsNoPaidMedia || pricingTotal.hasUncountable) && (
        <p className="text-xs text-gray-500 mt-1">
          {pricingTotal.hasPMNoBase ? 'PM (~10%) will be added once services are selected. ' : ''}
          {pricingTotal.hasMktOpsNoPaidMedia ? 'Marketing Ops (~10%) will be added once paid media services are selected. ' : ''}
          {pricingTotal.hasUncountable ? 'Some services require scoping for pricing.' : ''}
        </p>
      )}
    </div>
  );
}

// Engagement type mismatch alert - shown in services area when selected services
// don't align with the currently chosen engagement type
function EngagementMismatchAlert({ selectedServices, draftEngagementType, onSwitchType }) {
  if (!selectedServices || selectedServices.length === 0 || !draftEngagementType) return null;
  
  const billingAnalysis = analyzeServiceBillingModels(selectedServices);
  
  // Determine what engagement type the services actually need
  let recommendedType = null;
  let reason = '';
  
  if (billingAnalysis.needsIntegrated) {
    recommendedType = 'integrated';
    const modelSummary = billingAnalysis.activeBillingModels.map(model => {
      const cats = billingAnalysis.billingModelCategories[model];
      const label = model === 'fixed_fee' ? 'Fixed Fee' : model === 'tm' ? 'Time & Materials' : 'Retainer';
      return `${label} (${cats.map(c => c.category).join(', ')})`;
    }).join(', ');
    reason = `Your selected services span multiple billing models: ${modelSummary}. An Integrated engagement is recommended.`;
  } else if (billingAnalysis.activeBillingModels.length === 1) {
    recommendedType = billingAnalysis.activeBillingModels[0];
    const label = recommendedType === 'fixed_fee' ? 'Fixed Fee' : recommendedType === 'tm' ? 'Time & Materials' : 'Retainer';
    reason = `Your selected services are best suited to a ${label} engagement.`;
  }
  
  if (!recommendedType) return null;
  
  // T&M with Cap is a valid override — only warn, don't suggest switching away
  const currentIsCompatible = draftEngagementType === recommendedType 
    || (draftEngagementType === 'integrated' && billingAnalysis.activeBillingModels.length >= 1)
    || (draftEngagementType === 'tm_cap' && recommendedType === 'tm');
  
  if (currentIsCompatible) return null;
  
  const currentLabel = DRAFT_ENGAGEMENT_TYPES.find(t => t.value === draftEngagementType)?.label || draftEngagementType;
  const recommendedLabel = DRAFT_ENGAGEMENT_TYPES.find(t => t.value === recommendedType)?.label || recommendedType;
  
  return (
    <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
        <div className="w-full">
          <p className="text-sm font-medium text-amber-800">
            Engagement Type Mismatch
          </p>
          <p className="text-xs text-amber-700 mt-1">
            You've selected <strong>{currentLabel}</strong>, but {reason.charAt(0).toLowerCase() + reason.slice(1)}
          </p>
          <button
            onClick={() => onSwitchType(recommendedType)}
            className="mt-2 text-xs font-medium text-amber-800 underline hover:no-underline"
          >
            Switch to {recommendedLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
const extractClientBudget = (text) => {
  if (!text || typeof text !== 'string') return null;
  const amounts = [];

  // $50K, $1.5M, $200k — dollar sign with K/M suffix
  const reDollarSuffix = /\$\s*([\d,]+(?:\.\d+)?)\s*([kKmM])\b/g;
  let match;
  while ((match = reDollarSuffix.exec(text)) !== null) {
    let val = parseFloat(match[1].replace(/,/g, ''));
    const s = match[2].toLowerCase();
    if (s === 'k') val *= 1000;
    if (s === 'm') val *= 1000000;
    if (val >= 1000) amounts.push(val);
  }

  // $50,000 or $150000 — dollar sign with plain number (no K/M)
  const reDollarPlain = /\$\s*([\d,]+(?:\.\d+)?)(?!\s*[kKmM])\b/g;
  while ((match = reDollarPlain.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (val >= 1000) amounts.push(val);
  }

  // 50K, 200k, 1.5M — number with K/M suffix (no dollar sign, contextual)
  const reSuffix = /\b([\d,]+(?:\.\d+)?)\s*([kKmM])\b/g;
  while ((match = reSuffix.exec(text)) !== null) {
    let val = parseFloat(match[1].replace(/,/g, ''));
    const s = match[2].toLowerCase();
    if (s === 'k') val *= 1000;
    if (s === 'm') val *= 1000000;
    if (val >= 1000) amounts.push(val);
  }

  if (amounts.length === 0) return null;
  // Return the max — most likely the client's total budget figure
  return Math.max(...amounts);
};

const formatBudgetCurrency = (num) => {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num}`;
};

function BudgetWarningBar({ draftNotes, transcript, selectedServices }) {
  const clientBudget = Math.max(
    extractClientBudget(draftNotes) || 0,
    extractClientBudget(transcript) || 0
  ) || null;

  const pricingTotal = calculatePricingTotal(selectedServices);

  // Only show if we detected a budget AND have a pricing total AND budget is below the low end
  if (!clientBudget || !pricingTotal || clientBudget >= pricingTotal.low) return null;

  const shortfall = pricingTotal.low - clientBudget;
  const shortfallPct = Math.round((shortfall / pricingTotal.low) * 100);

  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Client budget may be insufficient
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Detected budget of <span className="font-bold">{formatBudgetCurrency(clientBudget)}</span> is below
            the estimated range low of <span className="font-bold">{pricingTotal.lowFormatted}</span>
            {shortfallPct > 0 && <span> — a gap of approximately {formatBudgetCurrency(shortfall)} ({shortfallPct}%)</span>}.
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Consider reducing services or discussing budget expectations with the client.
          </p>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ trigger, isSelected, selectedServices, onToggleService, onToggleBundle, boostedServices = {} }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const serviceNames = getServiceNames(trigger);
  const selectedCount = serviceNames.filter(s => selectedServices.includes(s)).length;
  
  // Helper to render archetype badge(s) for a service name
  const renderFitBadges = (serviceName) => {
    const archetypeIds = boostedServices[serviceName];
    if (!archetypeIds || archetypeIds.length === 0) return null;
    return archetypeIds.map(id => {
      const arch = FIT_ARCHETYPES[id];
      if (!arch) return null;
      return (
        <span key={id} className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-semibold align-middle" title={`Recommended for ${arch.title} archetype`}>
          {arch.emoji} {arch.title}
        </span>
      );
    });
  };
  
  // Helper to get combined archetype IDs for any services in a bundle
  const getBundleFitBadges = (bundleServices) => {
    const combined = {};
    for (const svc of bundleServices) {
      const ids = boostedServices[svc.name];
      if (ids) {
        for (const id of ids) {
          if (!combined[id]) combined[id] = FIT_ARCHETYPES[id];
        }
      }
    }
    return Object.entries(combined).map(([id, arch]) => (
      <span key={id} className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-semibold align-middle" title={`Recommended for ${arch.title} archetype`}>
        {arch.emoji} {arch.title}
      </span>
    ));
  };
  
  // Organize services into bundles and standalone
  const organizeServices = () => {
    const bundles = {};
    const standalone = [];
    
    for (const service of trigger.services) {
      const name = typeof service === 'object' ? service.name : service;
      const pricing = typeof service === 'object' ? service.pricing : null;
      const bundleName = pricing?.bundle;
      
      if (bundleName) {
        if (!bundles[bundleName]) {
          bundles[bundleName] = {
            name: bundleName,
            services: [],
            leadService: null, // The one with pricing details
            pricing: null
          };
        }
        bundles[bundleName].services.push({ name, service, pricing });
        // Lead service has budgetLow
        if (pricing?.budgetLow) {
          bundles[bundleName].leadService = name;
          bundles[bundleName].pricing = pricing;
        }
      } else {
        standalone.push({ name, service, pricing });
      }
    }
    
    return { bundles: Object.values(bundles), standalone };
  };
  
  const { bundles, standalone } = organizeServices();
  
  // Check if all services in a bundle are selected
  const isBundleSelected = (bundle) => {
    return bundle.services.every(s => selectedServices.includes(s.name));
  };
  
  // Format pricing for display
  const formatBundlePricing = (pricing) => {
    if (!pricing) return null;
    
    let term = null;
    if (pricing.termLow && pricing.termHigh) {
      if (pricing.termLow === pricing.termHigh) {
        term = pricing.termLow === 52 ? 'Annual' : `${pricing.termLow} weeks`;
      } else {
        term = `${pricing.termLow}-${pricing.termHigh} weeks`;
      }
    }
    
    let budget = null;
    if (pricing.budgetLow && pricing.budgetHigh) {
      const formatCurrency = (num) => {
        if (num >= 1000) return `$${(num/1000).toFixed(0)}K`;
        return `$${num}`;
      };
      budget = pricing.budgetLow === pricing.budgetHigh 
        ? formatCurrency(pricing.budgetLow)
        : `${formatCurrency(pricing.budgetLow)}-${formatCurrency(pricing.budgetHigh)}`;
    }
    
    return { term, budget, note: pricing.note };
  };
  
  return (
    <div className={`border-2 rounded-xl overflow-hidden transition-all ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <div className="text-left">
            <p className="font-semibold text-gray-900">{trigger.category}</p>
            <p className="text-sm text-gray-500">{trigger.description}</p>
          </div>
        </div>
        {selectedCount > 0 && (
          <span className="px-2.5 py-1 bg-gray-900 text-white text-xs rounded-full font-medium">
            {selectedCount} selected
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="px-5 pb-4 border-t border-gray-100 pt-3">
          <div className="space-y-3">
            {/* Render bundles first */}
            {bundles.map((bundle) => {
              const bundleSelected = isBundleSelected(bundle);
              const pricingInfo = formatBundlePricing(bundle.pricing);
              
              return (
                <div key={bundle.name} className="group">
                  {/* Bundle header - clickable */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bundleSelected}
                      onChange={() => onToggleBundle(bundle.services.map(s => s.name), !bundleSelected)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <div className="w-full">
                      <span className="text-sm font-medium text-gray-900">{bundle.name}</span>
                      <span className="text-xs text-gray-400 ml-2">({bundle.services.length} services)</span>
                      {bundle.services.some(s => boostedServices[s.name]) && getBundleFitBadges(bundle.services)}
                      {bundleSelected && pricingInfo && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {pricingInfo.term && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                              ⏱ {pricingInfo.term}
                            </span>
                          )}
                          {pricingInfo.budget && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                              💰 {pricingInfo.budget}
                            </span>
                          )}
                          {pricingInfo.note && (
                            <span className="text-xs text-gray-500 italic">
                              {pricingInfo.note}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                  
                  {/* Bundle members - indented, shown when bundle is selected */}
                  {bundleSelected && (
                    <div className="ml-7 mt-2 pl-3 border-l-2 border-gray-200 space-y-1">
                      {bundle.services.map((svc) => (
                        <div key={svc.name} className="flex items-center gap-2 text-xs text-gray-500">
                          <Check className="w-3 h-3 text-green-600" />
                          <span>{svc.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Render standalone services */}
            {standalone.map((svc) => {
              const isChecked = selectedServices.includes(svc.name);
              const pricingInfo = svc.pricing ? formatPricingGuidance(svc.service) : null;
              
              return (
                <div key={svc.name} className="group">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleService(svc.name)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <div className="w-full">
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">{svc.name}</span>
                      {boostedServices[svc.name] && renderFitBadges(svc.name)}
                      {pricingInfo && isChecked && (pricingInfo.term || pricingInfo.budget || pricingInfo.note) && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {pricingInfo.term && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                              ⏱ {pricingInfo.term}
                            </span>
                          )}
                          {pricingInfo.budget && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                              💰 {pricingInfo.budget}
                            </span>
                          )}
                          {pricingInfo.note && (
                            <span className="text-xs text-gray-500 italic">
                              {pricingInfo.note}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function App() {
  // Navigation state
  const [currentView, setCurrentView] = useState('home'); // 'home', 'draft', 'review'
  
  // Shared state
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('antenna_sow_api_key') || ''; } catch { return ''; }
  });
  
  // Persist API key to localStorage
  useEffect(() => {
    try {
      if (apiKey) localStorage.setItem('antenna_sow_api_key', apiKey);
      else localStorage.removeItem('antenna_sow_api_key');
    } catch {}
  }, [apiKey]);
  
  // Draft SOW state
  const [draftNotes, setDraftNotes] = useState('');
  const [draftEngagementType, setDraftEngagementType] = useState('');
  const [selectedArchetypes, setSelectedArchetypes] = useState(['architect']);
  const [transcript, setTranscript] = useState('');
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [transcriptAnalysis, setTranscriptAnalysis] = useState(null);
  const [detectedTriggers, setDetectedTriggers] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [showOtherServices, setShowOtherServices] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [generatedSOW, setGeneratedSOW] = useState(null);
  const [generatedPreScope, setGeneratedPreScope] = useState(null);
  const [isGeneratingPreScope, setIsGeneratingPreScope] = useState(false);
  const [draftError, setDraftError] = useState(null);
  
  // Review SOW state
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [reviewEngagementType, setReviewEngagementType] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [rawResponse, setRawResponse] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftedSOW, setDraftedSOW] = useState(null);
  const [reviewDraftError, setReviewDraftError] = useState(null);
  const [selectedRecommendations, setSelectedRecommendations] = useState({
    critical: [],
    recommended: [],
    redFlags: []
  });

  // Toggle a recommendation selection
  const toggleRecommendation = (type, index) => {
    setSelectedRecommendations(prev => {
      const current = prev[type] || [];
      if (current.includes(index)) {
        return { ...prev, [type]: current.filter(i => i !== index) };
      } else {
        return { ...prev, [type]: [...current, index] };
      }
    });
  };

  // Select/deselect all in a category
  const toggleAllInCategory = (type, items) => {
    setSelectedRecommendations(prev => {
      const current = prev[type] || [];
      const allSelected = items.length > 0 && current.length === items.length;
      if (allSelected) {
        return { ...prev, [type]: [] };
      } else {
        return { ...prev, [type]: items.map((_, idx) => idx) };
      }
    });
  };

  // ============================================================================
  // DRAFT SOW FUNCTIONS
  // ============================================================================

  // Helper: when a bundle lead is auto-selected, ensure all sub-services in that bundle are also selected
  // so the bundle checkbox renders as checked. Sub-services have no independent pricing, so this is UI-only.
  // Only completes bundles within the SAME trigger category to prevent cross-category contamination.
  const completeBundles = (serviceNames) => {
    const nameSet = new Set(serviceNames);
    
    // Build a map of bundleName → all service names, scoped per trigger category
    // Use "triggerId:bundleName" as key to prevent cross-category matching
    const bundleMap = {}; // "triggerId:bundleName" → [serviceName, ...]
    const serviceToBundleKeys = {}; // serviceName → ["triggerId:bundleName", ...]
    for (const trigger of SERVICE_TRIGGERS) {
      for (const service of trigger.services) {
        if (typeof service !== 'object' || !service.pricing?.bundle) continue;
        const bundleKey = `${trigger.id}:${service.pricing.bundle}`;
        if (!bundleMap[bundleKey]) bundleMap[bundleKey] = [];
        bundleMap[bundleKey].push(service.name);
        if (!serviceToBundleKeys[service.name]) serviceToBundleKeys[service.name] = [];
        serviceToBundleKeys[service.name].push(bundleKey);
      }
    }
    
    // For each selected service, complete its bundle(s) within the same category
    const completed = new Set(nameSet);
    for (const name of nameSet) {
      const keys = serviceToBundleKeys[name];
      if (!keys) continue;
      for (const key of keys) {
        for (const sibling of bundleMap[key]) {
          completed.add(sibling);
        }
      }
    }
    
    return [...completed];
  };

  const analyzeTranscript = async () => {
    if (!apiKey || !transcript.trim()) return;
    
    setIsAnalyzingTranscript(true);
    setDraftError(null);
    setTranscriptAnalysis(null);
    setDetectedTriggers([]);
    setSelectedServices([]);
    
    try {
      // Build comprehensive service categories description for AI using enhanced trigger patterns
      const serviceCategoriesPrompt = SERVICE_TRIGGERS.map(cat => {
        const patterns = cat.triggerPatterns || {};
        const directExamples = patterns.direct?.slice(0, 3).join(', ') || '';
        const indirectExamples = patterns.indirect?.slice(0, 3).join(', ') || '';
        const sampleLanguage = patterns.sampleLanguage?.slice(0, 3).join('" | "') || '';
        const situational = patterns.situational?.slice(0, 2).join(', ') || '';
        const performance = patterns.performance?.slice(0, 2).join(', ') || '';
        
        return `- ${cat.id}: "${cat.category}" - ${cat.description}
    Direct triggers: ${directExamples}
    Indirect signals: ${indirectExamples}
    Situational triggers: ${situational}
    Performance issues: ${performance}
    Client often says: "${sampleLanguage}"`;
      }).join('\n\n');
      
      // Use AI to analyze transcript AND detect relevant service categories semantically
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 6000,
          system: `You are an expert at analyzing client inputs to produce a comprehensive Project Summary for Statement of Work development at a marketing and communications agency. Your inputs include a client call transcript, additional notes from the account team, the selected client FIT archetype, and the chosen engagement type. Your job is to synthesize ALL of these inputs into a coherent project summary that will inform the SOW AND recommend relevant service categories based on the client's expressed needs.

## CRITICAL: SEMANTIC TRIGGER DETECTION

Do NOT look for exact phrase matches. Instead, understand the INTENT and MEANING behind what clients say. Client triggers manifest as:

1. **Pain Points**: Problems the client is experiencing (listen for frustration, complaints, "we're struggling with", "our challenge is")
2. **Ambitions**: Goals they want to achieve (listen for "we want to", "our goal is", "we're hoping to")
3. **Situational Changes**: Business events requiring marketing support (mergers, launches, new leadership, funding, expansion)
4. **Performance Gaps**: Metrics that aren't meeting expectations (declining numbers, competitive losses, ROI questions)
5. **Resource Constraints**: Lack of internal capacity or expertise (no team, overwhelmed, don't have time, don't know how)

## TRIGGER INTENSITY INDICATORS

Pay attention to urgency signals:
- **High Intensity** (urgent): "need this for [date]", "priority for the board", "losing money/customers", "competitor just [action]"
- **Medium Intensity** (active): "we've been thinking about", "it's on our roadmap", "want to explore"
- **Low Intensity** (consideration): "curious about", "someday we'd like to"

## COMBINED TRIGGER PATTERNS

Common combinations to look for:
- **Launch Scenarios** (product launch, funding, market entry) → GTM, PR, creative, paid social, website
- **Brand Transformation** (rebrand, repositioning, new leadership) → brand strategy, website, creative, integrated
- **Growth Mode** (scaling, expansion, competitive pressure) → SEO, performance marketing, content, measurement
- **Awareness Building** (low visibility, thought leadership goals) → PR, media outreach, executive visibility, content
- **Performance Optimization** (declining metrics, budget pressure) → performance marketing, measurement, A/B testing

## IMPORTANT GUIDELINES

1. Be GENEROUS in recommendations - it's better to suggest a category that might be relevant than to miss one
2. Look for the underlying NEED, not just the stated want
3. If a client mentions multiple pain points, recommend multiple categories
4. Consider what services often go TOGETHER (e.g., website + brand, PR + executive visibility)
5. If unsure, include the category - the user can deselect services they don't need

## CRITICAL: PR / EARNED MEDIA DETECTION

Do NOT recommend the "pr" category unless the client explicitly signals a need for EARNED MEDIA — meaning press coverage, journalist relationships, media pitching, press releases, or media outreach. The following are NOT sufficient on their own to trigger PR:
- General "awareness" or "visibility" goals (these are often addressed by paid social, content, SEO, or brand strategy)
- "Reputation" or "credibility" goals (these may be brand strategy, thought leadership, or content — not necessarily earned media)
- Product launches, company milestones, or funding rounds (these MIGHT need PR, but only if the client specifically wants press coverage or media attention for them)
- "Tell our story" (this is often content strategy or brand narrative, not media relations)

PR should only be a PRIMARY category when the client uses language like: press, media coverage, journalists, reporters, earned media, PR agency, press releases, media relations, news coverage, share of voice in media, or similar earned-media-specific language. It can be a SECONDARY (adjacent) recommendation for launch scenarios or awareness building, but should not auto-select as primary unless earned media intent is clear.`,
          messages: [{
            role: 'user',
            content: `Analyze ALL of the following inputs and produce a comprehensive Project Summary.

## INPUTS PROVIDED

### CLIENT CALL TRANSCRIPT:
${transcript}

### ADDITIONAL NOTES FROM ACCOUNT TEAM:
${draftNotes || 'None provided'}

### CLIENT FIT ARCHETYPE:
${selectedArchetypes.length > 0 ? selectedArchetypes.map(id => `${FIT_ARCHETYPES[id].emoji} ${FIT_ARCHETYPES[id].title}: ${FIT_ARCHETYPES[id].description}`).join('\n') : 'None selected'}
${selectedArchetypes.length === 2 ? '(Blended archetype — this client exhibits traits from both profiles)' : ''}

### ENGAGEMENT TYPE:
${draftEngagementType ? (DRAFT_ENGAGEMENT_TYPES.find(t => t.value === draftEngagementType)?.label || draftEngagementType) : 'Not yet selected'}

---

Provide TWO things based on ALL inputs above:

PART 1: PROJECT SUMMARY
Synthesize the transcript, additional notes, archetype profile, and engagement type into a sharp, consolidated project summary. Be concise and direct — every word should earn its place. Extract the following:

1. **EXECUTIVE SUMMARY** (max 60 words) - Who the client is, what they need, and the recommended approach. Reference the FIT archetype and engagement type to frame the engagement style. No filler.

2. **SUCCESS DEFINITION** (max 60 words) - What specific outcomes would make this engagement successful? What would make the client say "this was worth it"? Be concrete.

3. **PROBLEM STATEMENT** (max 30 words) - The core problem to solve. One or two sentences max. Direct and specific.

4. **TIMELINE** - Any deadlines, milestones, key dates, or timing requirements mentioned. Note urgency level if apparent. "Not specified" if none mentioned.

5. **BUDGET SIGNALS** - Any budget ranges, constraints, expectations, or indications of budget flexibility mentioned in either the transcript or additional notes. "Not specified" if none mentioned.

6. **WAY OF WORKING** (max 40 words) - Based on the FIT archetype selected, describe in one or two sentences how Antenna will approach the working relationship. Focus on the character of the partnership — e.g., structured, data-led, creatively ambitious, fast-moving. Do NOT list meetings or deliverables.

PART 2: RECOMMENDED SERVICE CATEGORIES
Based on the client's expressed needs, challenges, goals, pain points, and situational context, identify which service categories are relevant.

Think about:
- The INTENT behind what the client is saying
- What they need even if they didn't explicitly ask for it
- What services naturally go together for their situation
- Both their stated wants AND their underlying needs

Available categories (with trigger pattern examples):

${serviceCategoriesPrompt}

Format your response EXACTLY as:

## EXECUTIVE SUMMARY
[Max 60 words. Who, what, how — no filler.]

## SUCCESS DEFINITION
[Max 60 words. Concrete outcomes.]

## PROBLEM STATEMENT
[Max 30 words. Direct and specific.]

## TIMELINE
[Any timeline information, urgency level, or "Not specified" if none mentioned]

## BUDGET SIGNALS
[Any budget information, or "Not specified" if none mentioned]

## WAY OF WORKING
[Max 40 words. Partnership character based on FIT archetype. No meetings or deliverables.]

## PRIMARY_CATEGORIES
[List ONLY the category IDs that are CORE to the client's stated needs — the services they are explicitly asking for or that are essential to deliver what they want. Comma-separated. Be selective — only include categories the client clearly needs.]

## SECONDARY_CATEGORIES
[List category IDs that are ADJACENT or COMPLEMENTARY — services the client didn't explicitly ask for but could benefit from. Comma-separated. These will be shown as recommendations but not pre-selected.]

Example for a brand project:
PRIMARY_CATEGORIES: brand, integrated_strategy
SECONDARY_CATEGORIES: website, content_production, creative_production

Example for a PR + executive visibility project:
PRIMARY_CATEGORIES: pr, executive_visibility
SECONDARY_CATEGORIES: content_production, measurement, training`
          }]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }
      
      const data = await response.json();
      const analysisText = data.content[0].text;
      
      // Extract recommended categories from the response
      // The prompt asks for PRIMARY_CATEGORIES (core needs) and SECONDARY_CATEGORIES (adjacent services)
      const parseCategoryLine = (text, header) => {
        // Try "## HEADER\n content" format
        const pattern1 = new RegExp(`## ${header}\\s*\\n([^\\n#]+)`, 'i');
        const match1 = text.match(pattern1);
        if (match1) {
          return match1[1].split(',')
            .map(s => s.trim().toLowerCase().replace(/[_\s-]+/g, '_').replace(/[^a-z_]/g, ''))
            .filter(s => s.length > 0);
        }
        // Try "HEADER: content" or "HEADER\n content" format
        const pattern2 = new RegExp(`${header}[:\\s]*\\n?([^#]+?)(?=\\n\\n|\\n##|$)`, 'i');
        const match2 = text.match(pattern2);
        if (match2) {
          return match2[1].split(/[,\n]/)
            .map(s => s.trim().toLowerCase().replace(/[_\s-]+/g, '_').replace(/[^a-z_]/g, ''))
            .filter(s => s.length > 0);
        }
        return [];
      };
      
      let primaryCategoryIds = parseCategoryLine(analysisText, 'PRIMARY_CATEGORIES');
      let secondaryCategoryIds = parseCategoryLine(analysisText, 'SECONDARY_CATEGORIES');
      
      // Fallback: try legacy RECOMMENDED_CATEGORIES format
      if (primaryCategoryIds.length === 0 && secondaryCategoryIds.length === 0) {
        primaryCategoryIds = parseCategoryLine(analysisText, 'RECOMMENDED_CATEGORIES');
      }
      
      const allCategoryIds = [...new Set([...primaryCategoryIds, ...secondaryCategoryIds])];
      
      console.log('Primary category IDs:', primaryCategoryIds);
      console.log('Secondary category IDs:', secondaryCategoryIds);
      console.log('All category IDs:', allCategoryIds);
      
      // Map category IDs to full trigger objects (flexible matching)
      const matchCategories = (ids) => SERVICE_TRIGGERS.filter(trigger => {
        const triggerId = trigger.id.toLowerCase();
        return ids.some(detectedId => 
          detectedId === triggerId || 
          detectedId.includes(triggerId) || 
          triggerId.includes(detectedId) ||
          detectedId.replace(/_/g, '') === triggerId.replace(/_/g, '')
        );
      });
      
      const primaryTriggers = matchCategories(primaryCategoryIds);
      const detected = matchCategories(allCategoryIds); // All triggers for display
      
      console.log('Primary triggers:', primaryTriggers.map(t => t.id));
      console.log('All matched triggers:', detected.map(t => t.id));
      
      setDetectedTriggers(detected);
      
      // Auto-select services marked as 'always' recommend from PRIMARY triggers only
      // Secondary categories are shown but not auto-selected
      const autoSelectedServices = primaryTriggers.flatMap(trigger => 
        trigger.services
          .filter(service => typeof service === 'object' && service.recommend === 'always')
          .map(service => service.name)
      );
      
      // Merge in archetype-boosted services (only from detected categories for auto-selection)
      const archetypeBoostedMap = getArchetypeBoostedServices(primaryTriggers, selectedArchetypes);
      const archetypeBoosted = Object.keys(archetypeBoostedMap);
      // Only auto-select boosted services that belong to primary trigger categories
      const primaryServiceNames = new Set(
        primaryTriggers.flatMap(t => t.services.map(s => typeof s === 'object' ? s.name : s))
      );
      const archetypeBoostedForAutoSelect = archetypeBoosted.filter(name => primaryServiceNames.has(name));
      const mergedServices = [...new Set([...autoSelectedServices, ...archetypeBoostedForAutoSelect])];
      
      console.log('Auto-selected services:', autoSelectedServices);
      console.log('Archetype-boosted services (all):', archetypeBoosted);
      console.log('Archetype-boosted for auto-select (detected only):', archetypeBoostedForAutoSelect);
      
      const selectedServicesList = completeBundles(mergedServices).filter(name => 
        // Only include services that actually exist in SERVICE_TRIGGERS
        SERVICE_TRIGGERS.some(t => t.services.some(s => (typeof s === 'object' ? s.name : s) === name))
      );
      console.log('Final selected services after bundle completion:', selectedServicesList.length, selectedServicesList);
      setSelectedServices(selectedServicesList);
      
      // Auto-set engagement type based on selected services billing model analysis only
      // (Not influenced by FIT archetype or trigger order)
      if (selectedServicesList.length > 0) {
        const billingAnalysis = analyzeServiceBillingModels(selectedServicesList);
        console.log('Billing analysis:', billingAnalysis);
        
        if (billingAnalysis.needsIntegrated) {
          // Multiple billing models needed - use integrated
          setDraftEngagementType('integrated');
        } else if (billingAnalysis.activeBillingModels.length === 1) {
          // Single billing model - use it directly
          const model = billingAnalysis.activeBillingModels[0];
          setDraftEngagementType(model);
        }
      }
      
      // Remove the category sections from the displayed analysis
      const cleanedAnalysis = analysisText
        .replace(/## PRIMARY_CATEGORIES[\s\S]*$/, '')
        .replace(/## SECONDARY_CATEGORIES[\s\S]*$/, '')
        .replace(/## RECOMMENDED_CATEGORIES[\s\S]*$/, '')
        .trim();
      setTranscriptAnalysis(cleanedAnalysis);
      
    } catch (err) {
      setDraftError(err.message);
    } finally {
      setIsAnalyzingTranscript(false);
    }
  };
  
  // Toggle FIT archetype selection (max 2) and re-evaluate services if analysis exists
  const toggleArchetype = (archetypeId) => {
    setSelectedArchetypes(prev => {
      let next;
      if (prev.includes(archetypeId)) {
        next = prev.filter(a => a !== archetypeId);
      } else if (prev.length >= 2) {
        next = [prev[1], archetypeId];
      } else {
        next = [...prev, archetypeId];
      }
      
      // If transcript has been analyzed, re-evaluate service selection
      if (detectedTriggers.length > 0) {
        // Recalculate base auto-selected from triggers
        const baseServices = detectedTriggers.flatMap(trigger => 
          trigger.services
            .filter(service => typeof service === 'object' && service.recommend === 'always')
            .map(service => service.name)
        );
        // Add archetype-boosted services with the NEW archetype selection (only from detected categories)
        const archetypeBoostedMap = getArchetypeBoostedServices(detectedTriggers, next);
        const archetypeBoosted = Object.keys(archetypeBoostedMap);
        const detectedServiceNames = new Set(
          detectedTriggers.flatMap(t => t.services.map(s => typeof s === 'object' ? s.name : s))
        );
        const archetypeBoostedForAutoSelect = archetypeBoosted.filter(name => detectedServiceNames.has(name));
        const merged = completeBundles([...new Set([...baseServices, ...archetypeBoostedForAutoSelect])]).filter(name =>
          SERVICE_TRIGGERS.some(t => t.services.some(s => (typeof s === 'object' ? s.name : s) === name))
        );
        // Also keep any services the user manually added that aren't in base or boost
        setSelectedServices(current => {
          const manuallyAdded = current.filter(s => !baseServices.includes(s));
          return completeBundles([...new Set([...merged, ...manuallyAdded])]);
        });
      }
      
      return next;
    });
  };

  const getArchetypeBoostedServices = (detected, archetypes) => {
    if (!archetypes || archetypes.length === 0) return {};
    
    const boostedMap = {}; // serviceName → Set of archetypeIds
    
    const addBoosted = (serviceName, archetypeId) => {
      if (!boostedMap[serviceName]) boostedMap[serviceName] = new Set();
      boostedMap[serviceName].add(archetypeId);
    };
    
    for (const archetypeId of archetypes) {
      const archetype = FIT_ARCHETYPES[archetypeId];
      if (!archetype) continue;
      
      // Auto-select specific services from boosted categories that were detected
      for (const trigger of SERVICE_TRIGGERS) {
        const isDetected = detected.some(d => d.id === trigger.id);
        const isBoosted = archetype.boostCategories.includes(trigger.id);
        
        if (isDetected || isBoosted) {
          for (const service of trigger.services) {
            const name = typeof service === 'object' ? service.name : service;
            if (isDetected && isBoosted) {
              addBoosted(name, archetypeId);
            } else if (isBoosted && typeof service === 'object' && service.recommend === 'always') {
              addBoosted(name, archetypeId);
            }
          }
        }
      }
      
      // Also add explicitly named boost services
      for (const serviceName of archetype.boostServices) {
        addBoosted(serviceName, archetypeId);
      }
    }
    
    // Convert Sets to arrays for easy consumption
    const result = {};
    for (const [name, ids] of Object.entries(boostedMap)) {
      result[name] = [...ids];
    }
    return result;
  };

  const toggleService = (service) => {
    setSelectedServices(prev => 
      prev.includes(service) 
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };
  
  // Toggle all services in a bundle at once
  const toggleBundle = (serviceNames, shouldSelect) => {
    setSelectedServices(prev => {
      if (shouldSelect) {
        // Add all bundle services that aren't already selected
        const newServices = serviceNames.filter(s => !prev.includes(s));
        return [...prev, ...newServices];
      } else {
        // Remove all bundle services
        return prev.filter(s => !serviceNames.includes(s));
      }
    });
  };
  
  const generateSOW = async () => {
    if (!apiKey || selectedServices.length === 0) return;
    
    setIsGeneratingDraft(true);
    setDraftError(null);
    
    try {
      const engagementLabel = DRAFT_ENGAGEMENT_TYPES.find(t => t.value === draftEngagementType)?.label || 'Fixed Fee';
      const engagementType = draftEngagementType || 'fixed_fee';
      
      // Get engagement-specific guidance
      const engagementGuidance = {
        fixed_fee: `FIXED FEE ENGAGEMENT REQUIREMENTS:
- Scope must be exhaustively defined - all deliverables with specifications
- All quantities and volumes must be specified
- Revision rounds must be specified and limited (recommend: up to 2 rounds per deliverable)
- Meeting and consultation time must be limited (use "up to X hours")
- Include strong exclusions section listing what is NOT included
- Document all assumptions with consequences if they prove false
- Include change order process requiring written approval for ANY additions
- Client obligations must have specific timeframes and consequences for non-compliance
- Define clear acceptance criteria for each deliverable
- Include deemed acceptance provision (e.g., "if no response within 5 business days")

BUDGET & BILLING STRUCTURE FOR FIXED FEE:
- Present total project fee prominently
- Payment schedule tied to milestones or phases (NOT a single lump sum)
- Recommended structure: 50% at project kickoff, 25% at [mid-project milestone], 25% upon completion
- Alternative for larger projects: Monthly installments over project duration
- All milestone payments are non-refundable once work commences
- State: "Fee is based on scope defined herein. Changes to scope require a Change Order with fee adjustment."
- For branding projects: Minimum project value $50,000
- For brand assessments: $4,000`,
        
        tm_cap: `TIME & MATERIALS WITH CAP (NOT TO EXCEED) REQUIREMENTS:
NOTE: T&M with Cap should only be used when specifically requested by client. It shifts risk to the agency.

- Cap must be clearly stated with inclusions and exclusions
- Cap must be explicitly tied to the defined scope
- Include notification thresholds (e.g., "Agency will notify Client when 75% of cap is consumed")
- Include work stoppage rights when cap is approached
- Scope changes must require cap adjustment
- Assumption failures are grounds for cap adjustment
- Specify billing rates by role
- Specify billing increment (e.g., 15-minute increments)
- Include reporting requirements (frequency and content)
- No obligation to work beyond cap without written authorization

BUDGET & BILLING STRUCTURE FOR T&M WITH CAP:
- Present cap amount prominently with clear statement: "Total fees shall not exceed $[CAP] without prior written authorization"
- Include rate card by role/seniority
- Billing: Monthly in arrears based on actual time incurred
- Payment: Net 30 from invoice date
- Include utilization reporting with each invoice
- State: "Agency will notify Client when 75% of cap has been consumed. Work will pause at cap unless Client authorizes additional budget in writing."
- Cap does NOT include out-of-pocket expenses (list separately)`,
        
        tm: `TIME & MATERIALS REQUIREMENTS:
Best suited for creative retainers and engagements where deliverables evolve based on business needs.

- Complete rate schedule for all roles that may work on the project
- Clear billing increment (e.g., 15-minute increments)
- MINIMUM COMMITMENT required (NOT a cap - this is a floor)
- Scope guidance with intended objectives and boundaries
- Monthly or quarterly planning and prioritization process
- Tracking and reporting requirements

BUDGET & BILLING STRUCTURE FOR T&M:
- Present as MINIMUM COMMITMENT, not a cap or estimate
- State: "Client commits to a minimum of $[AMOUNT] for the term. This commitment enables Agency to reserve capacity and resources."
- For creative retainers: Minimum commitment of $24,000 annually
- For other T&M work: Minimum retainer of $15,000/month
- Include rate card by role/seniority
- Billing: Monthly in arrears based on actual time incurred
- Payment: Net 30 from invoice date
- Work exceeding minimum commitment billed at same rates
- Include: "Agency and Client will conduct [monthly/quarterly] planning sessions to prioritize work and align on objectives."
- DO NOT use "drawdown" language - this is not a deposit to be depleted, it's a minimum spend commitment
- Unused commitment does NOT roll over or create refund obligations`,
        
        retainer: `RETAINER REQUIREMENTS:
Best suited for ongoing professional services like PR, media relations, thought leadership, and social media.

- Minimum term specified (recommend: 6-12 months)
- Monthly fee clearly stated
- Early termination provisions and fees (e.g., 60-day notice, or fee for early termination)
- Services included clearly enumerated
- Monthly hour allocation or deliverable allocation specified
- Services explicitly EXCLUDED
- Rollover policy clearly stated (recommend: limited or no rollover)
- Overage handling defined (rate, notification threshold, pre-approval)
- Utilization tracking and reporting frequency
- Notice period for non-renewal
- Annual rate adjustment provisions if applicable

BUDGET & BILLING STRUCTURE FOR RETAINER:
- Present monthly retainer fee prominently
- Minimum retainer: $15,000/month
- State: "Monthly retainer of $[AMOUNT] payable in advance on the first of each month"
- Include: "Retainer secures [X hours / defined activities] per month"
- Rollover: "Unused hours [do not roll over / may roll over up to X hours to the immediately following month only]"
- Overage: "Work exceeding monthly allocation will be billed at $[RATE]/hour with Client pre-approval required for overages exceeding [X] hours"
- Minimum term: "Initial term of [6/12] months. Either party may terminate with [60] days written notice after initial term."
- Include utilization reporting: "Agency will provide monthly utilization reports showing hours/activities consumed against allocation."`,

        integrated: `INTEGRATED ENGAGEMENT REQUIREMENTS:
This engagement combines multiple billing models based on the nature of different service lines. Structure the SOW with clearly separated sections for each billing model.

STRUCTURE:
The SOW should have distinct sections for each billing type, with clear separation:

SECTION A - FIXED FEE WORK (Project-Based):
For defined deliverables like branding, strategy, website builds, campaigns, events:
- Exhaustively defined scope with all deliverables specified
- Quantities and revision limits stated
- Milestone-based payments
- Clear completion criteria for each phase
- Change order process for scope changes

SECTION B - RETAINER SERVICES (Ongoing Professional Services):
For PR, media relations, thought leadership, paid social, SEO:
- Monthly fee clearly stated
- Included activities/hours per month specified
- Rollover policy (recommend: limited or none)
- Overage handling defined
- Minimum term and termination provisions

SECTION C - TIME & MATERIALS (Creative/Content Retainer):
For creative production, content creation where deliverables evolve:
- Minimum commitment (floor, not cap)
- Rate card by role
- Monthly planning and prioritization process
- Billing in arrears based on actual time

BUDGET & BILLING STRUCTURE FOR INTEGRATED:
Present fees in clearly separated sections matching the structure above.

Example format:
"SECTION A - BRAND STRATEGY (Fixed Fee)
Total Project Fee: $[XX,XXX]
- 50% ($[X,XXX]) due at project kickoff
- 25% ($[X,XXX]) due upon Strategy approval
- 25% ($[X,XXX]) due upon Expression delivery

SECTION B - PUBLIC RELATIONS (Monthly Retainer)
Monthly Retainer: $[XX,XXX]/month
- Minimum term: [X] months
- Includes: [defined scope]

SECTION C - CREATIVE PRODUCTION (Time & Materials)
Minimum Annual Commitment: $[XX,XXX]
- Billed monthly in arrears at rates below
- [Rate card]"

IMPORTANT:
- Each section operates independently with its own terms
- Fixed Fee sections have defined completion; Retainer/T&M sections have terms
- Cross-reference between sections where work depends on other sections
- Include master assumptions and client responsibilities that apply to ALL sections`
      };
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 16000,
          system: `You are an expert at drafting professional Statements of Work for Antenna Group, a marketing and communications agency. You create SOWs that protect the agency while being fair and professional for clients.

## CORE SOW STANDARDS (Apply to ALL SOWs)

### Structure and Numbering
- Use decimal numbering throughout (1.1, 1.1.1, 1.1.1.1) - NEVER bullet points in formal sections
- Every deliverable, activity, output, and assumption must have a unique reference number

### Language Standards
- Use "up to" language for flexibility (e.g., "up to 4 hours per month", "up to 2 rounds of revisions")
- NEVER use vague terms like: "as needed", "ongoing", "various", "reasonable", "unlimited", "best efforts"
- Use active voice with clear responsibility: "Agency will...", "Client will..."
- Define any terms that could be interpreted differently

### Deliverable Structure
Each deliverable MUST include:
- **Activities**: What Agency will DO (active voice)
- **Outputs**: What Agency will PRODUCE (with quantities using "1x", "up to 3x" notation)
- **Assumptions**: Conditions that must be true for this scope/fee to hold
- **Completion Criteria**: Explicit trigger for when this deliverable is considered complete

### Client Responsibilities Section (REQUIRED)
Must include:
1. Consolidated Feedback: "Client agrees to consolidate all internal feedback before submission to Agency. Feedback must represent unified organizational direction."
2. Approval Windows: "Client commits to providing feedback within [X] business days. Deliverables not rejected within this window shall be deemed approved."
3. Change Control: "Any change to scope, timeline, or budget requires mutual written agreement via change order."
4. Stakeholder Limits: "Agency will interface with a maximum of [X] client stakeholders for feedback purposes."
5. Input Requirements: What materials, access, or information client must provide
6. Consequences: What happens if client fails to meet obligations

### Master Assumptions Section (REQUIRED)
Must include:
1. Scope Boundaries: "This SOW does not include..." with specific exclusions
2. Revision Limits: "Up to [X] rounds of revisions included per deliverable"
3. Response Times: Expected client response times for different actions
4. Pause/Termination Ladder: "If Client delays exceed [X] business days, Agency may pause work"

### Out of Scope / Exclusions (REQUIRED)
Explicitly list what is NOT included. Consider:
- Rush fees and expedited timelines
- Additional revision rounds beyond stated limits
- Crisis communications (unless included)
- Paid media spend management
- Travel outside defined geography
- Third-party vendor management
- Content creation not explicitly listed
- Legal or regulatory review

${engagementGuidance[engagementType] || engagementGuidance.fixed_fee}

${selectedArchetypes.length > 0 ? `## CLIENT FIT ARCHETYPE GUIDANCE
${selectedArchetypes.map(id => FIT_ARCHETYPES[id].sowGuidance).join('\n\n')}

## WAYS OF WORKING
${selectedArchetypes.map(id => FIT_ARCHETYPES[id].waysOfWorking).join('\n\n')}
IMPORTANT: Include a "Ways of Working" or "Engagement Operating Model" section in the SOW that reflects this archetype's preferred communication, governance, reporting, and approval approach. This section should appear after Client Responsibilities and before Assumptions. Adapt the language to feel natural within the SOW — do not copy verbatim, but ensure the operational style matches this client's archetype.

## PRICING & FEE GUIDANCE (Archetype-Specific)
${selectedArchetypes.map(id => FIT_ARCHETYPES[id].pricingGuidance).join('\n\n')}
${selectedArchetypes.length === 2 ? `
BLEND NOTE: This client is a ${selectedArchetypes.map(id => FIT_ARCHETYPES[id].title).join(' + ')} blend. Balance both archetype preferences throughout the SOW — weave together the priorities from each archetype rather than treating them as separate sections. The Ways of Working should reflect a natural synthesis of both styles.` : ''}` : ''}

${ASSESSMENT_FRAMEWORK}`,
          messages: [{
            role: 'user',
            content: `Create a professional Statement of Work based on the following information:

## ENGAGEMENT TYPE
${engagementLabel}
${selectedArchetypes.length > 0 ? `
## CLIENT FIT ARCHETYPE
${selectedArchetypes.map(id => `${FIT_ARCHETYPES[id].emoji} ${FIT_ARCHETYPES[id].title}: ${FIT_ARCHETYPES[id].description}`).join('\n')}
${selectedArchetypes.length === 2 ? `\nThis is a BLENDED archetype — tailor the SOW to balance both profiles.` : ''}

IMPORTANT: Include a dedicated "Engagement Operating Model" or "Ways of Working" section in the SOW that establishes governance, communication cadence, approval workflows, and reporting expectations tailored to this archetype. Also adapt the fee structure presentation to match this archetype's pricing preferences.
` : ''}
${engagementType === 'integrated' ? `
## BILLING MODEL BREAKDOWN
${(() => {
  const billingAnalysis = analyzeServiceBillingModels(selectedServices);
  let breakdown = '';
  if (billingAnalysis.billingModelCategories.fixed_fee.length > 0) {
    breakdown += `\nFIXED FEE SECTION (Project-Based):\n${billingAnalysis.billingModelCategories.fixed_fee.map(c => `- ${c.category}: ${c.services.join(', ')}`).join('\n')}`;
  }
  if (billingAnalysis.billingModelCategories.retainer.length > 0) {
    breakdown += `\nRETAINER SECTION (Ongoing Services):\n${billingAnalysis.billingModelCategories.retainer.map(c => `- ${c.category}: ${c.services.join(', ')}`).join('\n')}`;
  }
  if (billingAnalysis.billingModelCategories.tm.length > 0) {
    breakdown += `\nTIME & MATERIALS SECTION (Creative/Content):\n${billingAnalysis.billingModelCategories.tm.map(c => `- ${c.category}: ${c.services.join(', ')}`).join('\n')}`;
  }
  return breakdown;
})()}

IMPORTANT: Structure the SOW with clearly separated sections for each billing model as shown above. Each section should have its own fee structure, terms, and deliverables appropriate to that billing model.
` : ''}
## ADDITIONAL NOTES FROM ACCOUNT TEAM
${draftNotes || 'None provided'}

## PROJECT SUMMARY
${transcriptAnalysis || 'No project summary produced'}

## SELECTED SERVICES TO INCLUDE
${selectedServices.map(s => `- ${s}`).join('\n')}

## REQUIREMENTS FOR THIS SOW

Generate a complete, client-ready SOW that:

1. **Addresses Client Needs**: Directly addresses the success criteria and problems identified in the project summary

2. **Structured Deliverables**: Includes all selected services as properly structured deliverables with:
   - Clear activities (what Agency will DO)
   - Specific outputs (what Agency will PRODUCE with quantities)
   - Assumptions for each deliverable
   - Explicit completion criteria

3. **Client Responsibilities**: Comprehensive section including:
   - Consolidated feedback requirement
   - Approval windows with deemed acceptance
   - Change control process
   - Stakeholder limits
   - Input requirements with deadlines
   - Consequences for non-compliance

4. **Engagement Operating Model / Ways of Working**: A dedicated section that establishes:
   - Governance structure and review cadences (adapted to the client's FIT archetype)
   - Communication approach and reporting rhythm
   - Approval and decision-making workflow
   - Meeting and status update frequency and format
   - This section should feel tailored to the client, not boilerplate — reference the FIT Archetype guidance

5. **Master Assumptions**: Including:
   - Scope boundaries and exclusions
   - Revision limits
   - Response time expectations
   - Pause/termination provisions

6. **Proper Formatting**:
   - Decimal numbering throughout (1.1, 1.1.1, etc.)
   - "Up to" language for all quantities and timeframes
   - Clear section headers
   - Professional tone

7. **Fee Summary**: Appropriate for a ${engagementLabel} engagement with:
   - Clear fee structure
   - Payment schedule tied to milestones or phases
   - Rate card for additional work if applicable
   - Expense handling
   - Fee presentation adapted to the client's FIT archetype pricing preferences

8. **Scope Protection**: Clear exclusions and boundaries to prevent scope creep

The SOW should be ready for client presentation with minimal editing needed. Make it thorough but readable.`
          }]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }
      
      const data = await response.json();
      setGeneratedSOW(data.content[0].text);
      
    } catch (err) {
      setDraftError(err.message);
    } finally {
      setIsGeneratingDraft(false);
    }
  };
  
  const downloadGeneratedSOW = async () => {
    if (!generatedSOW) return;
    const filename = `SOW_Draft_${new Date().toISOString().split('T')[0]}.docx`;
    await downloadAsDocx(generatedSOW, filename, {
      title: 'Statement of Work (SOW)',
      client: '',
    });
  };
  
  // Helper to build selected services with pricing for pre-scope
  const getSelectedServicesPricingSummary = () => {
    const result = [];
    const countedBundles = new Set();
    const formatCurrency = (num) => {
      if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `$${Math.round(num / 1000)}K`;
      return `$${num}`;
    };
    
    for (const trigger of SERVICE_TRIGGERS) {
      const categoryServices = [];
      for (const service of trigger.services) {
        const name = typeof service === 'object' ? service.name : service;
        if (!selectedServices.includes(name)) continue;
        const pricing = service.pricing;
        if (!pricing) { categoryServices.push({ name, range: 'Scoping required' }); continue; }
        if (pricing.percentageOfProject || pricing.percentageOfPaidMedia) continue;
        if (pricing.bundle && !pricing.budgetLow) continue;
        if (pricing.bundle) { if (countedBundles.has(pricing.bundle)) continue; countedBundles.add(pricing.bundle); }
        let range = '';
        if (pricing.budgetLow && pricing.budgetHigh) {
          range = `${formatCurrency(pricing.budgetLow)} – ${formatCurrency(pricing.budgetHigh)}`;
        } else if (pricing.budgetLow) {
          range = `From ${formatCurrency(pricing.budgetLow)}`;
        }
        if (pricing.note) range += ` (${pricing.note})`;
        categoryServices.push({ name, range });
      }
      if (categoryServices.length > 0) {
        result.push({ category: trigger.category, services: categoryServices });
      }
    }
    return result;
  };
  
  const generatePreScope = async () => {
    if (!apiKey || selectedServices.length === 0) return;
    
    setIsGeneratingPreScope(true);
    setDraftError(null);
    
    try {
      // Build services + pricing context for the prompt
      const servicesSummary = getSelectedServicesPricingSummary();
      const servicesText = servicesSummary.map(cat =>
        `${cat.category}:\n${cat.services.map(s => `  - ${s.name}${s.range ? ': ' + s.range : ''}`).join('\n')}`
      ).join('\n\n');
      
      const pricingTotal = calculatePricingTotal(selectedServices);
      let totalBudgetText = 'To be scoped';
      if (pricingTotal) {
        totalBudgetText = `${pricingTotal.lowFormatted} – ${pricingTotal.highFormatted}`;
        if (pricingTotal.hasPM) totalBudgetText += ` (includes project management)`;
      }
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8000,
          system: `You are a senior strategist at Antenna Group, a marketing and communications agency, writing a client-facing Pre-Scope document. This document is warm, professional, confident, and specific. It should feel like a senior advisor laying out a clear, actionable recommendation with enough detail that the client can see exactly what they're getting.

TONE & STYLE:
- Confident and advisory — like a trusted partner making a clear recommendation
- Specific and concrete — describe exactly what Antenna will DO and PRODUCE for each service
- Warm but professional — not a legal document, not a vague overview
- Use "Antenna will..." to describe activities — active, direct language
- Write service descriptions as flowing paragraphs, not bullet lists

CRITICAL FORMATTING RULES:
- Use markdown formatting with ## headers
- Each proposed service should be a ### heading with (price range, timeline) in parentheses
- Service descriptions should be 2-4 sentences of SPECIFIC activities and outputs — what Antenna will do, what will be produced, what the client can expect
- Do NOT invent specific dollar amounts — use the budget ranges provided in the services data
- Do NOT invent specific timelines — use the term ranges provided, or say "timeline to be confirmed during scoping" if none provided
- Do NOT include legal language, change order processes, revision limits, or SOW-style protections
- Do NOT pad with generic marketing language — every sentence should convey specific information about what will be delivered`,
          messages: [{
            role: 'user',
            content: `Generate a Pre-Scope document using the information below.

## DOCUMENT STRUCTURE

The document MUST follow this EXACT structure. Do not add extra sections.

### 1. TITLE
Use: "## Pre-Scope Document"

### 2. INTRODUCTION (use this text verbatim as the first paragraph, no header)
"This document details each proposed deliverable and the outputs you can anticipate in a formal contract. It is intended to encourage conversation and be iterated until it represents the services and focus that you want to see. Once it is finalized, we will quickly move forward with an SOW and start work."

### 3. DEFINITION OF SUCCESS
Use the header "## Definition of Success" and write 2-4 sentences describing what success looks like for this engagement. Pull directly from the client's stated goals and the project summary. Be specific about the outcomes, not the activities.

### 4. PROPOSED SERVICES
Use the header "## Proposed Services"

This is the CORE of the document. For EACH service or service bundle listed below, create a subsection formatted as:

### [Service Name] — ([budget range], [timeline])

Then write 2-4 sentences describing:
- What Antenna will DO (specific activities — research, workshops, development, etc.)
- What will be PRODUCED (specific deliverables — documents, designs, reports, platforms, etc.)
- Key details the client should know (what's included, what it covers, any important context)

IMPORTANT GUIDELINES for service descriptions:
- Be SPECIFIC to the client's situation using context from the Project Summary
- Describe activities in terms of what the client will experience and receive
- Where services are bundled, describe the bundle as a cohesive offering, not individual line items
- Use language like "Antenna will..." to describe activities
- Include quantities where known (e.g., "up to 3 naming options", "up to 2 visual territories")
- Reference the client's specific goals, industry, or challenges where relevant
- If a service is a retainer, note the monthly commitment and what it covers
- If a service is T&M, note the minimum commitment and what types of work it covers

### 5. HOW WE'LL WORK TOGETHER
Use the header "## How We'll Work Together" and write a short paragraph (3-5 sentences) describing the philosophy of the working relationship. Focus on the CHARACTER of the partnership (transparent, structured, adaptive, creatively led, data-driven, etc.) NOT specific meetings, cadences, workshops, or deliverables. Those details belong in the SOW. Base this on the FIT Archetype guidance if provided.

### 6. ESTIMATED TOTALS
Use the header "## Estimated Totals"

Break the total into categories where applicable:
- **One-Off / Project:** [sum of fixed-fee services]
- **Retained Services:** [sum of retainer services, expressed as monthly or annual]

Then add a brief note about project timeline and any overlap between workstreams, similar to:
"Please note that some deliverables may overlap. [Brief timeline summary based on what's known.]"

### 7. NEXT STEPS
Write 2-3 sentences encouraging the client to review, flag adjustments, and confirming we'll move quickly to SOW once aligned.

---

## REFERENCE: DER COALITION PRE-SCOPE EXAMPLE

Here is an example of the TONE and DETAIL LEVEL expected for service descriptions. Your output should match this level of specificity:

"Onboarding, Rapid Discovery & Stakeholder Research - ($13,000, 2 Weeks)
Antenna will spend 1 week onboarding onto your existing brand, reviewing any foundational documentation and data you can share. An Assignment brief will be created to ensure that we have a clear definition of success for the project and ways of working that work for you. The production of a discussion guide and 3-5 IDIs (in-depth interviews) with coalition-identified stakeholders will be held and recorded. Based upon the Assignment Brief and IDIs, Antenna will conduct desk research on your audience and landscape to identify audience needs and landscape opportunities."

"Brand Strategy - ($20,000, 2-3 Weeks)
Based on the above, the Antenna team will produce a brand strategy hypothesis document that outlines new language and positioning opportunities for your brand based on what you have told us and what we have learned, alongside creative guidance for all identified creative deliverables. This will be presented as a creative brief and will be iterated until final approval is given. The Antenna team will produce naming options based on the creative brief and brand strategy hypothesis to arrive at three (3) viable and available options."

Note how each description: starts with what Antenna will DO, specifies what will be PRODUCED, includes concrete quantities, and references the client's specific situation.

---

## PROJECT SUMMARY
${transcriptAnalysis || 'No project summary available'}

## ADDITIONAL NOTES
${draftNotes || 'None provided'}

## SELECTED SERVICES WITH BUDGET RANGES
${servicesText}

## TOTAL ESTIMATED BUDGET RANGE
${totalBudgetText}

${selectedArchetypes.length > 0 ? `## FIT ARCHETYPE (for How We'll Work Together section)
${selectedArchetypes.map(id => `${FIT_ARCHETYPES[id].emoji} ${FIT_ARCHETYPES[id].title}: ${FIT_ARCHETYPES[id].short}
${FIT_ARCHETYPES[id].waysOfWorking}`).join('\n\n')}
${selectedArchetypes.length === 2 ? `\nThis client is a ${selectedArchetypes.map(id => FIT_ARCHETYPES[id].title).join(' + ')} blend — synthesize both working styles naturally.` : ''}
IMPORTANT: The "How We'll Work Together" section should distill the archetype into a brief paragraph about the partnership philosophy. Do NOT list specific meetings, cadences, reporting formats, or tactical processes.` : ''}

Generate the complete Pre-Scope document now.`
          }]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }
      
      const data = await response.json();
      setGeneratedPreScope(data.content[0].text);
      
    } catch (err) {
      setDraftError(err.message);
    } finally {
      setIsGeneratingPreScope(false);
    }
  };
  
  const downloadGeneratedPreScope = async () => {
    if (!generatedPreScope) return;
    const filename = `Pre-Scope_${new Date().toISOString().split('T')[0]}.docx`;
    await downloadAsDocx(generatedPreScope, filename, {
      title: 'Pre-Scope Summary',
      client: '',
    });
  };
  
  const resetDraft = () => {
    setDraftNotes('');
    setDraftEngagementType('');
    setTranscript('');
    setTranscriptAnalysis(null);
    setDetectedTriggers([]);
    setSelectedServices([]);
    setShowOtherServices(false);
    setGeneratedSOW(null);
    setGeneratedPreScope(null);
    setDraftError(null);
  };

  const saveDraftToJson = () => {
    const draftState = {
      _version: APP_VERSION,
      _savedAt: new Date().toISOString(),
      draftNotes,
      draftEngagementType,
      selectedArchetypes,
      transcript,
      transcriptAnalysis,
      detectedTriggers: detectedTriggers.map(t => t.id),
      selectedServices,
      generatedSOW,
      generatedPreScope,
    };
    const blob = new Blob([JSON.stringify(draftState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const datePart = new Date().toISOString().split('T')[0];
    const namePart = transcriptAnalysis ? transcriptAnalysis.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-') : 'draft';
    a.href = url;
    a.download = `SOW-Draft_${namePart}_${datePart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadDraftFromJson = (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // Restore state
        if (data.draftNotes != null) setDraftNotes(data.draftNotes);
        if (data.draftEngagementType != null) setDraftEngagementType(data.draftEngagementType);
        if (data.selectedArchetypes != null) setSelectedArchetypes(data.selectedArchetypes);
        if (data.transcript != null) setTranscript(data.transcript);
        if (data.transcriptAnalysis != null) setTranscriptAnalysis(data.transcriptAnalysis);
        if (data.selectedServices != null) setSelectedServices(data.selectedServices);
        if (data.generatedSOW != null) setGeneratedSOW(data.generatedSOW);
        if (data.generatedPreScope != null) setGeneratedPreScope(data.generatedPreScope);
        // Restore detected triggers from IDs
        if (data.detectedTriggers && Array.isArray(data.detectedTriggers)) {
          const restored = data.detectedTriggers
            .map(id => SERVICE_TRIGGERS.find(t => t.id === id))
            .filter(Boolean);
          setDetectedTriggers(restored);
        }
        setDraftError(null);
        setCurrentView('draft');
      } catch (err) {
        setDraftError('Failed to load draft file: ' + err.message);
      }
    };
    reader.readAsText(uploadedFile);
    // Reset file input so same file can be loaded again
    event.target.value = '';
  };

  // ============================================================================
  // REVIEW SOW FUNCTIONS
  // ============================================================================
  
  const handleFileUpload = useCallback(async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setAnalysis(null);

    if (uploadedFile.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        setFileContent({ type: 'pdf', data: base64 });
      };
      reader.readAsDataURL(uploadedFile);
    } else if (uploadedFile.type === 'text/plain' || uploadedFile.name.endsWith('.txt') || uploadedFile.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContent({ type: 'text', data: e.target.result });
      };
      reader.readAsText(uploadedFile);
    } else if (uploadedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || uploadedFile.name.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        setFileContent({ type: 'docx', data: base64 });
      };
      reader.readAsDataURL(uploadedFile);
    } else {
      setError('Please upload a PDF, DOCX, or text file');
      setFile(null);
    }
  }, []);

  const analyzeSOW = async () => {
    if (!apiKey || !fileContent || !reviewEngagementType) return;

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setRawResponse('');
    setDraftedSOW(null);

    try {
      const engagementLabel = REVIEW_ENGAGEMENT_TYPES.find(t => t.value === reviewEngagementType)?.label || reviewEngagementType;
      
      const promptText = `${ASSESSMENT_FRAMEWORK}

${PRICING_GUIDE}

You are reviewing an SOW for a ${engagementLabel} engagement.

## CRITICAL FORMATTING REQUIREMENTS

Every issue you report MUST include:
1. A clear description of the problem
2. The specific action needed to fix it
3. Either the exact text to change OR the exact text to add

DO NOT output simple bullet lists without context. Each issue must be self-contained and actionable.

## Issue Format

**For LANGUAGE ISSUES (text exists but needs improvement):**
Section X.X: [Clear description of the problem]
Current: "[quote the EXACT problematic text from the document]"
Recommended: "[the replacement text - ready to copy/paste]"
Why: [one sentence explaining the risk]

**For MISSING ELEMENTS (something is entirely absent):**
Section: [where to add it, or "New section needed"]
Missing: [what element is missing - be specific]
Add: "[the complete language to add - ready to copy/paste]"
Why: [one sentence explaining the risk]

## IMPORTANT RULES

1. NEVER output orphaned bullet points without context
2. NEVER just list items that are in the SOW without explaining what's wrong
3. Every issue MUST have either "Current/Recommended" OR "Missing/Add" format
4. If something is GOOD (like having an exclusions section), don't list it as a critical issue
5. Only flag actual problems that need fixing
6. CREATIVE/DEPOSIT RETAINERS: If you see language like "minimum commitment... held as deposit and drawn down" this is NOT an "up to" cap - it's a FLOOR. The client pays the minimum upfront and CAN spend MORE on T&M. Do NOT recommend adding rollover policies or "up to" language to deposit amounts.
7. BUDGET NUMBERS: Do NOT invent budget numbers in recommendations. Use "$xxxx.xx" as a placeholder unless:
   - The SOW already specifies a budget value (use that value)
   - It's one of these known Antenna Group minimums:
     • Branding Strategy & Expression projects: $50,000 minimum
     • Creative T&M retainer deposit: $24,000 minimum
     • Brand assessment: $4,000
     • Minimum retainers: $15,000

## Response Structure

1. CRITICAL ISSUES - Things that MUST be fixed before issuing
(Each issue must follow the format above with full context)

2. RECOMMENDED IMPROVEMENTS - Things that SHOULD be fixed
(Each issue must follow the format above with full context)

3. RED FLAGS FOUND - Problematic phrases that need replacement
Format EACH as: "[exact phrase found]" in Section X.X → "[recommended replacement]"
Prefer "UP TO" language (e.g., "up to 4 hours per month") rather than exact quantification.

4. STRUCTURAL COMPLIANCE - Check each required element for ${engagementLabel} engagements
✓ Present: [element] - [where found]
✗ Missing: [element] - [what to add]

5. PRICING VALIDATION - Compare SOW fees against guide pricing
For each service/deliverable with a fee mentioned in the SOW:
- Identify the service category and fee amount stated
- Compare against the PRICING GUIDE ranges above
- Flag as:
  ⚠️ UNDERPRICED: [Service] at $X is below guide range of $Y-$Z (risk: undervaluing work, profitability)
  ⚠️ OVERPRICED: [Service] at $X is above guide range of $Y-$Z (risk: client pushback, competitive disadvantage)
  ✓ IN RANGE: [Service] at $X falls within guide range of $Y-$Z
- For retainers, convert to annual amounts for comparison (monthly × 12)
- For bundled services, compare against bundle pricing, not individual service prices
- Note if Project Management fee is missing on non-PR engagements (should be ~10% of project)
- Note if Marketing Operations fee is missing when paid media services are included (should be ~10% of paid media management fees)
- Note if Cross-agency Coordination is missing when scope involves managing other agencies, partners, or third parties ($5K-$10K/month)

6. BUDGET VERIFICATION - Check fee table arithmetic, billing schedule alignment

7. OVERALL ASSESSMENT
- Compliance score (1-10) with justification
- Top 3 priorities to address
- What's working well

Remember: Quality over quantity. Only report actual issues that need action, with complete context for each.`;


      let messages = [];
      
      if (fileContent.type === 'pdf') {
        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileContent.data }},
            { type: 'text', text: promptText }
          ]
        }];
      } else if (fileContent.type === 'text') {
        messages = [{
          role: 'user',
          content: `${promptText}\n\n=== SOW CONTENT START ===\n${fileContent.data}\n=== SOW CONTENT END ===`
        }];
      } else {
        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: fileContent.data }},
            { type: 'text', text: promptText }
          ]
        }];
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8000,
          messages
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const responseText = data.content[0].text;
      setRawResponse(responseText);

      // Parse response into sections - improved to handle various AI formatting styles
      const parseSection = (text, startMarkers, endMarkers) => {
        // Try multiple possible start markers
        const markers = Array.isArray(startMarkers) ? startMarkers : [startMarkers];
        let startIdx = -1;
        let usedMarkerLength = 0;
        
        for (const marker of markers) {
          const idx = text.indexOf(marker);
          if (idx !== -1 && (startIdx === -1 || idx < startIdx)) {
            startIdx = idx;
            usedMarkerLength = marker.length;
          }
        }
        
        if (startIdx === -1) return [];
        
        let endIdx = text.length;
        for (const marker of endMarkers) {
          const idx = text.indexOf(marker, startIdx + usedMarkerLength);
          if (idx !== -1 && idx < endIdx) endIdx = idx;
        }
        
        const section = text.slice(startIdx + usedMarkerLength, endIdx).trim();
        
        // Split on issue boundaries - handle various formats:
        // **Section D.2.2:** or Section D.2.2: or ### Section or numbered items
        const issuePattern = /\n(?=\*{0,2}Section\s+[\d.A-Za-z]+[:\*]|#{1,3}\s+Section|(?:^|\n)\d+\.\s+[A-Z])/gi;
        let items = section.split(issuePattern).map(s => s.trim()).filter(s => s.length > 0);
        
        // If no splits occurred, try splitting on double newlines (paragraph breaks)
        if (items.length <= 1 && section.length > 100) {
          items = section.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 0);
        }
        
        // Filter out items that are:
        // 1. Too short (< 20 chars) - likely orphaned fragments
        // 2. Just simple bullet points without context
        // 3. Headers without content
        return items.filter(item => {
          // Must be substantial
          if (item.length < 30) return false;
          
          // Skip if it's just a header line
          if (/^#{1,3}\s+\w+$/.test(item.trim())) return false;
          
          // If it starts with "- " and doesn't contain actionable markers, skip it
          if (item.startsWith('- ') && !item.includes(':') && !item.includes('→') && item.length < 100) {
            return false;
          }
          
          // Keep items that have structure (Section, Current/Recommended, Missing/Add, etc.)
          const hasStructure = /Section|Current:|Recommended:|Missing:|Add:|Why:|→/i.test(item);
          const isSubstantive = item.length > 60 || hasStructure;
          
          return isSubstantive;
        });
      };

      // Try multiple variations of section headers the AI might use
      const parsedAnalysis = {
        critical: parseSection(responseText, 
          ['## CRITICAL ISSUES', '1. CRITICAL ISSUES', '**CRITICAL ISSUES', '# CRITICAL ISSUES', 'CRITICAL ISSUES'], 
          ['## RECOMMENDED', '2. RECOMMENDED', '**RECOMMENDED', '## 2.', '3. RED FLAGS', '## RED FLAGS']
        ),
        recommended: parseSection(responseText, 
          ['## RECOMMENDED IMPROVEMENTS', '2. RECOMMENDED IMPROVEMENTS', '**RECOMMENDED', '# RECOMMENDED'], 
          ['## RED FLAGS', '3. RED FLAGS', '**RED FLAGS', '## 3.', '4. STRUCTURAL', '4. SERVICE-LINE', '## STRUCTURAL', '## SERVICE-LINE']
        ),
        redFlags: parseSection(responseText, 
          ['## RED FLAGS', '3. RED FLAGS FOUND', '3. RED FLAGS', '**RED FLAGS'], 
          ['## STRUCTURAL', '## SERVICE-LINE', '4. STRUCTURAL', '4. SERVICE-LINE', '**STRUCTURAL', '**SERVICE-LINE', '## 4.', '5. PRICING', '## PRICING']
        ),
        compliance: responseText.match(/(?:##?\s*)?(?:4\.\s*)?(?:STRUCTURAL|SERVICE-LINE) COMPLIANCE[\s\S]*?(?=(?:##?\s*)?(?:5\.\s*)?PRICING|(?:##?\s*)?(?:6\.\s*)?BUDGET|(?:##?\s*)?(?:7\.\s*)?OVERALL|$)/i)?.[0]
          ?.replace(/(?:##?\s*)?(?:4\.\s*)?(?:STRUCTURAL|SERVICE-LINE) COMPLIANCE/i, '').trim(),
        pricing: responseText.match(/(?:##?\s*)?(?:5\.\s*)?PRICING VALIDATION[\s\S]*?(?=(?:##?\s*)?(?:6\.\s*)?BUDGET|(?:##?\s*)?(?:7\.\s*)?OVERALL|$)/i)?.[0]
          ?.replace(/(?:##?\s*)?(?:5\.\s*)?PRICING VALIDATION/i, '').trim(),
        budget: responseText.match(/(?:##?\s*)?(?:6\.\s*)?BUDGET VERIFICATION[\s\S]*?(?=(?:##?\s*)?(?:7\.\s*)?OVERALL|$)/i)?.[0]
          ?.replace(/(?:##?\s*)?(?:6\.\s*)?BUDGET VERIFICATION/i, '').trim(),
        overall: responseText.match(/(?:##?\s*)?(?:7\.\s*)?OVERALL ASSESSMENT[\s\S]*$/i)?.[0]
          ?.replace(/(?:##?\s*)?(?:7\.\s*)?OVERALL ASSESSMENT/i, '').trim()
      };

      setAnalysis(parsedAnalysis);
      
      // Initialize all recommendations as selected (checked) by default
      setSelectedRecommendations({
        critical: (parsedAnalysis.critical || []).map((_, idx) => idx),
        recommended: (parsedAnalysis.recommended || []).map((_, idx) => idx),
        redFlags: (parsedAnalysis.redFlags || []).map((_, idx) => idx)
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateRevisedDraft = async () => {
    if (!apiKey || !fileContent || !analysis) return;
    
    setIsDrafting(true);
    setReviewDraftError(null);
    
    try {
      // Build filtered analysis based on selected recommendations
      const selectedCritical = (analysis.critical || [])
        .filter((_, idx) => selectedRecommendations.critical.includes(idx));
      const selectedRecommended = (analysis.recommended || [])
        .filter((_, idx) => selectedRecommendations.recommended.includes(idx));
      const selectedRedFlags = (analysis.redFlags || [])
        .filter((_, idx) => selectedRecommendations.redFlags.includes(idx));
      
      const filteredAnalysis = `## SELECTED CHANGES TO APPLY

### Critical Issues to Fix (${selectedCritical.length} selected):
${selectedCritical.length > 0 ? selectedCritical.map((issue, i) => `${i + 1}. ${issue}`).join('\n\n') : 'None selected'}

### Recommended Improvements to Apply (${selectedRecommended.length} selected):
${selectedRecommended.length > 0 ? selectedRecommended.map((issue, i) => `${i + 1}. ${issue}`).join('\n\n') : 'None selected'}

### Red Flag Language to Replace (${selectedRedFlags.length} selected):
${selectedRedFlags.length > 0 ? selectedRedFlags.map((flag, i) => `${i + 1}. ${flag}`).join('\n') : 'None selected'}

### Additional Context (Structural Compliance, Pricing, Budget, Overall):
${analysis.compliance || 'N/A'}
${analysis.pricing || 'N/A'}
${analysis.budget || 'N/A'}
${analysis.overall || 'N/A'}`;

      let messages = [];
      const draftPrompt = `Based on the SELECTED changes provided below, create a COMPLETE REVISED VERSION of this SOW that:

1. Applies ONLY the critical fixes that were selected
2. Incorporates ONLY the recommended improvements that were selected
3. Replaces ONLY the red flag language that was selected (using "up to" language)
4. Adds any missing required sections mentioned in the selected items
5. Maintains the original structure and intent while improving quality
6. Uses proper decimal numbering throughout
7. KEEP unchanged any sections where the recommendation was NOT selected

${filteredAnalysis}

Output the complete revised SOW text. Mark sections you've modified with [REVISED] and new sections with [NEW].`;

      if (fileContent.type === 'pdf') {
        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileContent.data }},
            { type: 'text', text: draftPrompt }
          ]
        }];
      } else if (fileContent.type === 'text') {
        messages = [{
          role: 'user',
          content: `${draftPrompt}\n\n=== ORIGINAL SOW ===\n${fileContent.data}`
        }];
      } else {
        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: fileContent.data }},
            { type: 'text', text: draftPrompt }
          ]
        }];
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 16000,
          messages
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate draft');
      }

      const data = await response.json();
      setDraftedSOW(data.content[0].text);
    } catch (err) {
      setReviewDraftError(err.message);
    } finally {
      setIsDrafting(false);
    }
  };

  const downloadRevisedDraft = async () => {
    if (!draftedSOW) return;
    const originalName = file?.name?.replace(/\.[^/.]+$/, '') || 'SOW';
    const filename = `${originalName}_REVISED.docx`;
    await downloadAsDocx(draftedSOW, filename, {
      title: `${originalName} - Revised`,
    });
  };

  const resetReview = () => {
    setFile(null);
    setFileContent(null);
    setReviewEngagementType('');
    setAnalysis(null);
    setRawResponse('');
    setDraftedSOW(null);
    setError(null);
    setSelectedRecommendations({ critical: [], recommended: [], redFlags: [] });
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  // Compute archetype-boosted services for FIT badges
  const currentBoostedServices = getArchetypeBoostedServices(detectedTriggers, selectedArchetypes);
  
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#E8E6E1' }}>
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-10" style={{ backgroundColor: '#E8E6E1' }}>
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentView('home')} className="hover:opacity-80 transition-opacity">
              <AntennaLogo className="h-8" />
            </button>
            <a 
              href="https://www.antennagroup.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Back to Antenna
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        
        {/* ================================================================== */}
        {/* HOME VIEW */}
        {/* ================================================================== */}
        {currentView === 'home' && (
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              SOW Workbench
            </h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-16">
              Draft new Statements of Work from client calls or review existing SOWs against Antenna Group quality standards.
            </p>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Draft SOW Card */}
              <button
                onClick={() => setCurrentView('draft')}
                className="group relative p-8 bg-white rounded-2xl border-2 border-gray-200 hover:border-[#12161E] transition-all text-left overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-gray-100 group-hover:bg-[#12161E] rounded-xl flex items-center justify-center mb-6 transition-colors">
                    <PenTool className="w-7 h-7 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">Draft a New SOW</h2>
                  <p className="text-gray-500 mb-4">
                    Create a Statement of Work from scratch using client call transcripts, notes, and FIT archetype selection. AI produces a project summary and recommends services.
                  </p>
                  <div className="flex items-center gap-2 text-[#12161E] font-semibold">
                    <span className="relative overflow-hidden">
                      <span className="relative inline-block">
                        Get started
                        {/* Yellow highlight with black text - slides down on hover */}
                        <span 
                          className="absolute inset-0 flex items-center transition-transform duration-300 ease-out group-hover:translate-y-full pointer-events-none"
                          style={{ backgroundColor: '#E8FF00' }}
                        >
                          <span style={{ color: '#12161E' }}>Get started</span>
                        </span>
                      </span>
                    </span>
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
              
              {/* Review SOW Card */}
              <button
                onClick={() => setCurrentView('review')}
                className="group relative p-8 bg-white rounded-2xl border-2 border-gray-200 hover:border-[#12161E] transition-all text-left overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-gray-100 group-hover:bg-[#12161E] rounded-xl flex items-center justify-center mb-6 transition-colors">
                    <Search className="w-7 h-7 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">Review an Existing SOW</h2>
                  <p className="text-gray-500 mb-4">
                    Upload an SOW for automated quality assessment against Antenna Group standards. Get specific recommendations and generate revised drafts.
                  </p>
                  <div className="flex items-center gap-2 text-[#12161E] font-semibold">
                    <span className="relative overflow-hidden">
                      <span className="relative inline-block">
                        Get started
                        {/* Yellow highlight with black text - slides down on hover */}
                        <span 
                          className="absolute inset-0 flex items-center transition-transform duration-300 ease-out group-hover:translate-y-full pointer-events-none"
                          style={{ backgroundColor: '#E8FF00' }}
                        >
                          <span style={{ color: '#12161E' }}>Get started</span>
                        </span>
                      </span>
                    </span>
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            </div>
            
            {/* Resume Saved Draft */}
            <div className="mt-8 text-center">
              <label className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-900 cursor-pointer transition-colors">
                <FolderOpen className="w-4 h-4" />
                Resume a saved draft
                <input type="file" accept=".json" onChange={loadDraftFromJson} className="hidden" />
              </label>
            </div>
            
            {/* Version number */}
            <div className="mt-16 text-right">
              <span className="text-xs text-gray-400 font-mono">v{APP_VERSION}</span>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* DRAFT SOW VIEW */}
        {/* ================================================================== */}
        {currentView === 'draft' && !generatedSOW && !generatedPreScope && (
          <>
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={() => setCurrentView('home')}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to home
              </button>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-all">
                  <FolderOpen className="w-4 h-4" />
                  Load Draft
                  <input type="file" accept=".json" onChange={loadDraftFromJson} className="hidden" />
                </label>
                {(transcript || selectedServices.length > 0 || draftNotes) && (
                  <button
                    onClick={saveDraftToJson}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save Draft
                  </button>
                )}
              </div>
            </div>
            
            <div className="mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Draft a New SOW</h1>
              <p className="text-xl text-gray-500">
                Paste a client call transcript, add notes, and select a FIT archetype to produce a project summary and recommended services.
              </p>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column - Inputs */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} />
                  
                  {/* Engagement Type */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-3">Engagement Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      {DRAFT_ENGAGEMENT_TYPES.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setDraftEngagementType(type.value)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            draftEngagementType === type.value
                              ? 'border-gray-900 bg-gray-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900 text-sm">{type.label}</p>
                          <p className="text-xs text-gray-500">{type.description}</p>
                        </button>
                      ))}
                    </div>
                    
                    {/* Engagement Type Recommendation */}
                    {(() => {
                      console.log('Checking engagement recommendation - selectedServices:', selectedServices, 'draftEngagementType:', draftEngagementType);
                      const recommendation = getEngagementTypeRecommendation(selectedServices, detectedTriggers, draftEngagementType);
                      console.log('Engagement recommendation result:', recommendation);
                      if (!recommendation) return null;
                      
                      const bgColor = recommendation.type === 'warning' 
                        ? 'bg-amber-50 border-amber-200' 
                        : recommendation.type === 'suggestion'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-green-50 border-green-200';
                      const textColor = recommendation.type === 'warning'
                        ? 'text-amber-800'
                        : recommendation.type === 'suggestion'
                        ? 'text-blue-800'
                        : 'text-green-800';
                      const iconColor = recommendation.type === 'warning'
                        ? 'text-amber-600'
                        : recommendation.type === 'suggestion'
                        ? 'text-blue-600'
                        : 'text-green-600';
                      
                      return (
                        <div className={`mt-3 p-3 rounded-lg border ${bgColor}`}>
                          <div className="flex items-start gap-2">
                            {recommendation.type === 'warning' ? (
                              <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
                            ) : recommendation.type === 'suggestion' ? (
                              <Lightbulb className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
                            ) : (
                              <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
                            )}
                            <div>
                              <p className={`text-sm font-medium ${textColor}`}>{recommendation.title}</p>
                              <p className={`text-xs ${textColor} opacity-80 mt-1`}>{recommendation.message}</p>
                              {recommendation.type !== 'confirmation' && recommendation.recommendedType && (
                                <button
                                  onClick={() => setDraftEngagementType(recommendation.recommendedType)}
                                  className={`mt-2 text-xs font-medium ${textColor} underline hover:no-underline`}
                                >
                                  Switch to {DRAFT_ENGAGEMENT_TYPES.find(t => t.value === recommendation.recommendedType)?.label}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* FIT Archetype */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Select Client FIT Archetype</label>
                    <p className="text-xs text-gray-500 mb-3">Tailors service recommendations, SOW language, ways of working, and pricing approach. Select up to 2 for a blend. Defaults to Architect.</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.values(FIT_ARCHETYPES).map((archetype) => {
                        const isSelected = selectedArchetypes.includes(archetype.id);
                        return (
                          <button
                            key={archetype.id}
                            onClick={() => toggleArchetype(archetype.id)}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              isSelected
                                ? 'border-gray-900 bg-gray-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{archetype.emoji}</span>
                              <p className="font-semibold text-gray-900 text-sm">{archetype.title}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{archetype.short}</p>
                          </button>
                        );
                      })}
                    </div>
                    {selectedArchetypes.length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-700">
                            {selectedArchetypes.length === 1 ? 'Selected:' : 'Blend:'}
                          </span>
                          {selectedArchetypes.map(id => (
                            <span key={id} className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                              {FIT_ARCHETYPES[id].emoji} {FIT_ARCHETYPES[id].title}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500">
                          {selectedArchetypes.map(id => FIT_ARCHETYPES[id].description).join(' ')}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1.5 italic">
                          Affects: service emphasis, SOW tone & control language, ways of working section, pricing approach
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Notes */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Additional Notes (optional)
                    </label>
                    <textarea
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      placeholder="Any specific requirements, budget constraints, timeline notes, or context the AI should know..."
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-900 placeholder:text-gray-400 min-h-[100px] resize-y"
                    />
                  </div>
                  
                  {/* Transcript */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Client Call Transcript
                      </div>
                    </label>
                    <textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      placeholder="Paste the transcript of your client call here. The AI will analyze it to identify what services they need and extract key requirements..."
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-900 placeholder:text-gray-400 min-h-[200px] resize-y font-mono text-sm"
                    />
                  </div>
                  
                  {draftError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-start gap-3 text-red-600">
                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{draftError}</p>
                      </div>
                    </div>
                  )}
                  
                  <AntennaButton
                    onClick={analyzeTranscript}
                    disabled={!apiKey || !transcript.trim()}
                    loading={isAnalyzingTranscript}
                    loadingText="Producing Summary..."
                    icon={Lightbulb}
                    className="w-full"
                    size="large"
                  >
                    Produce Summary and Recommended Services
                  </AntennaButton>
                </div>
              </div>
              
              {/* Right Column - Project Summary & Services */}
              <div className="space-y-6">
                {transcriptAnalysis && (
                  <>
                    {/* Project Summary */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Target className="w-5 h-5 text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Project Summary</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(() => {
                          const sections = [];
                          const sectionDefs = [
                            { key: 'EXECUTIVE SUMMARY', icon: '📋', label: 'Executive Summary', span: 2 },
                            { key: 'SUCCESS DEFINITION', icon: '🎯', label: 'Success Definition', span: 1 },
                            { key: 'PROBLEM STATEMENT', icon: '⚡', label: 'Problem Statement', span: 1 },
                            { key: 'TIMELINE', icon: '📅', label: 'Timeline', span: 1 },
                            { key: 'BUDGET SIGNALS', icon: '💰', label: 'Budget Signals', span: 1 },
                            { key: 'WAY OF WORKING', icon: '🤝', label: 'Way of Working', span: 2 },
                          ];
                          const text = transcriptAnalysis || '';
                          for (let i = 0; i < sectionDefs.length; i++) {
                            const def = sectionDefs[i];
                            const marker = `## ${def.key}`;
                            const startIdx = text.indexOf(marker);
                            if (startIdx === -1) continue;
                            const contentStart = startIdx + marker.length;
                            // Find next ## or PRIMARY_CATEGORIES or end
                            let endIdx = text.length;
                            const nextSection = text.indexOf('\n## ', contentStart);
                            if (nextSection !== -1) endIdx = nextSection;
                            const content = text.slice(contentStart, endIdx).trim();
                            if (!content) continue;
                            sections.push(
                              <div key={def.key} className={`bg-gray-50 rounded-xl p-4 ${def.span === 2 ? 'md:col-span-2' : ''}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-base">{def.icon}</span>
                                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{def.label}</span>
                                </div>
                                <p className="text-sm text-gray-800 leading-relaxed">{content}</p>
                              </div>
                            );
                          }
                          return sections;
                        })()}
                      </div>
                    </div>
                    
                    {/* Detected Service Triggers */}
                    {detectedTriggers.length > 0 && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Recommended Services</h3>
                            <p className="text-sm text-gray-500">Based on client needs identified in the project summary</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {detectedTriggers.map((trigger) => (
                            <ServiceCard
                              key={trigger.id}
                              trigger={trigger}
                              isSelected={getServiceNames(trigger).some(s => selectedServices.includes(s))}
                              selectedServices={selectedServices}
                              onToggleService={toggleService}
                              onToggleBundle={toggleBundle}
                              boostedServices={currentBoostedServices}
                            />
                          ))}
                        </div>
                        
                        {/* Other Services - categories not auto-detected */}
                        {SERVICE_TRIGGERS.filter(t => !detectedTriggers.some(d => d.id === t.id)).length > 0 && (
                          <div className="mt-6 pt-6 border-t border-gray-200">
                            <button
                              onClick={() => setShowOtherServices(!showOtherServices)}
                              className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-4"
                            >
                              {showOtherServices ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              Other Services ({SERVICE_TRIGGERS.filter(t => !detectedTriggers.some(d => d.id === t.id)).length} categories)
                            </button>
                            {showOtherServices && (
                              <div className="space-y-4">
                                {SERVICE_TRIGGERS.filter(t => !detectedTriggers.some(d => d.id === t.id)).map((trigger) => (
                                  <ServiceCard
                                    key={trigger.id}
                                    trigger={trigger}
                                    isSelected={getServiceNames(trigger).some(s => selectedServices.includes(s))}
                                    selectedServices={selectedServices}
                                    onToggleService={toggleService}
                                    onToggleBundle={toggleBundle}
                                    boostedServices={currentBoostedServices}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {selectedServices.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-gray-900">
                                {selectedServices.length} services selected
                              </p>
                              <button
                                onClick={() => setSelectedServices([])}
                                className="text-sm text-gray-500 hover:text-gray-900"
                              >
                                Clear all
                              </button>
                            </div>
                            <PricingTotalBar selectedServices={selectedServices} />
                            <EngagementMismatchAlert selectedServices={selectedServices} draftEngagementType={draftEngagementType} onSwitchType={setDraftEngagementType} />
                            <BudgetWarningBar draftNotes={draftNotes} transcript={transcript} selectedServices={selectedServices} />
                            <div className="space-y-3">
                              <AntennaButton
                                onClick={generatePreScope}
                                disabled={!transcriptAnalysis}
                                loading={isGeneratingPreScope}
                                loadingText="Generating..."
                                icon={FileText}
                                variant="secondary"
                                className="w-full"
                                size="large"
                              >
                                Generate Pre-Scope
                              </AntennaButton>
                              <AntennaButton
                                onClick={generateSOW}
                                disabled={!draftEngagementType}
                                loading={isGeneratingDraft}
                                loadingText="Generating SOW..."
                                icon={Sparkles}
                                className="w-full"
                                size="large"
                              >
                                Generate SOW Draft
                              </AntennaButton>
                            </div>
                            {!draftEngagementType && !isGeneratingPreScope && (
                              <p className="text-sm text-amber-600 mt-2 text-center">Select an engagement type to generate a SOW Draft</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* All Service Categories (if no triggers detected) */}
                    {detectedTriggers.length === 0 && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Select Services Manually</h3>
                            <p className="text-sm text-gray-500">Choose the services to include in your SOW</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {SERVICE_TRIGGERS.map((trigger) => (
                            <ServiceCard
                              key={trigger.id}
                              trigger={trigger}
                              isSelected={getServiceNames(trigger).some(s => selectedServices.includes(s))}
                              selectedServices={selectedServices}
                              onToggleService={toggleService}
                              onToggleBundle={toggleBundle}
                              boostedServices={currentBoostedServices}
                            />
                          ))}
                        </div>
                        
                        {selectedServices.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-gray-900">
                                {selectedServices.length} services selected
                              </p>
                              <button
                                onClick={() => setSelectedServices([])}
                                className="text-sm text-gray-500 hover:text-gray-900"
                              >
                                Clear all
                              </button>
                            </div>
                            <PricingTotalBar selectedServices={selectedServices} />
                            <EngagementMismatchAlert selectedServices={selectedServices} draftEngagementType={draftEngagementType} onSwitchType={setDraftEngagementType} />
                            <BudgetWarningBar draftNotes={draftNotes} transcript={transcript} selectedServices={selectedServices} />
                            <div className="space-y-3">
                              <AntennaButton
                                onClick={generatePreScope}
                                disabled={!transcriptAnalysis}
                                loading={isGeneratingPreScope}
                                loadingText="Generating..."
                                icon={FileText}
                                variant="secondary"
                                className="w-full"
                                size="large"
                              >
                                Generate Pre-Scope
                              </AntennaButton>
                              <AntennaButton
                                onClick={generateSOW}
                                disabled={!draftEngagementType}
                                loading={isGeneratingDraft}
                                loadingText="Generating SOW..."
                                icon={Sparkles}
                                className="w-full"
                                size="large"
                              >
                                Generate SOW Draft
                              </AntennaButton>
                            </div>
                            {!draftEngagementType && !isGeneratingPreScope && (
                              <p className="text-sm text-amber-600 mt-2 text-center">Select an engagement type to generate a SOW Draft</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {!transcriptAnalysis && (
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Paste a transcript to get started</h3>
                    <p className="text-sm text-gray-500">
                      Add a transcript and any additional notes, then produce a Project Summary with recommended services.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Generated Document View (SOW and/or Pre-Scope) */}
        {currentView === 'draft' && (generatedSOW || generatedPreScope) && (
          <>
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {generatedSOW && generatedPreScope ? 'Documents Generated' : generatedSOW ? 'SOW Draft Generated' : 'Pre-Scope Generated'}
                </h1>
                <p className="text-gray-500">
                  {draftEngagementType ? `${DRAFT_ENGAGEMENT_TYPES.find(t => t.value === draftEngagementType)?.label} • ` : ''}{selectedServices.length} services included
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {generatedPreScope && (
                  <AntennaButton
                    onClick={downloadGeneratedPreScope}
                    icon={Download}
                    variant="secondary"
                    size="default"
                  >
                    Download Pre-Scope
                  </AntennaButton>
                )}
                {generatedSOW && (
                  <AntennaButton
                    onClick={downloadGeneratedSOW}
                    icon={Download}
                    size="default"
                  >
                    Download SOW
                  </AntennaButton>
                )}
                <AntennaButton
                  onClick={() => { setGeneratedSOW(null); setGeneratedPreScope(null); }}
                  variant="secondary"
                  icon={PenTool}
                  size="default"
                >
                  Refine Services
                </AntennaButton>
                <AntennaButton
                  onClick={saveDraftToJson}
                  variant="secondary"
                  icon={Save}
                  size="default"
                >
                  Save Draft
                </AntennaButton>
                <AntennaButton
                  onClick={resetDraft}
                  variant="ghost"
                  size="default"
                >
                  Start Over
                </AntennaButton>
              </div>
            </div>
            
            {/* Generate the other document if only one exists */}
            {generatedPreScope && !generatedSOW && draftEngagementType && (
              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Ready to create the full SOW?</p>
                  <p className="text-xs text-blue-600 mt-0.5">Generate a detailed Statement of Work from the same services and settings.</p>
                </div>
                <AntennaButton
                  onClick={generateSOW}
                  loading={isGeneratingDraft}
                  loadingText="Generating..."
                  icon={Sparkles}
                  size="default"
                >
                  Generate SOW Draft
                </AntennaButton>
              </div>
            )}
            {generatedSOW && !generatedPreScope && (
              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Need a client-facing summary?</p>
                  <p className="text-xs text-blue-600 mt-0.5">Generate a Pre-Scope document to share with the client before the full SOW.</p>
                </div>
                <AntennaButton
                  onClick={generatePreScope}
                  loading={isGeneratingPreScope}
                  loadingText="Generating..."
                  icon={FileText}
                  size="default"
                >
                  Generate Pre-Scope
                </AntennaButton>
              </div>
            )}
            
            {/* Pre-Scope Document */}
            {generatedPreScope && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-600" />
                    <span className="font-semibold text-gray-900">Pre-Scope</span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">Client-Facing</span>
                  </div>
                  <CopyButton text={generatedPreScope} />
                </div>
                <div className="p-6 max-h-[70vh] overflow-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono leading-relaxed">{generatedPreScope}</pre>
                </div>
              </div>
            )}
            
            {/* SOW Document */}
            {generatedSOW && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-gray-600" />
                    <span className="font-semibold text-gray-900">Statement of Work</span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">Internal Draft</span>
                  </div>
                  <CopyButton text={generatedSOW} />
                </div>
                <div className="p-6 max-h-[70vh] overflow-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono leading-relaxed">{generatedSOW}</pre>
                </div>
              </div>
            )}
          </>
        )}

        {/* ================================================================== */}
        {/* REVIEW SOW VIEW */}
        {/* ================================================================== */}
        {currentView === 'review' && !analysis && (
          <>
            <button
              onClick={() => setCurrentView('home')}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to home
            </button>
            
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Review an Existing SOW</h1>
              <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                Upload a Statement of Work for automated quality assessment against Antenna Group standards.
              </p>
            </div>
            
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 p-8">
              <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} />

              {/* File Upload */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Upload SOW Document
                </label>
                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                    file ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileUpload} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {file ? (
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-14 h-14 bg-gray-900 rounded-xl flex items-center justify-center">
                          <FileText className="w-7 h-7 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB • Click to change</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-900 font-medium mb-1">Click to upload or drag and drop</p>
                        <p className="text-sm text-gray-500">PDF, DOCX, or TXT files supported</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Engagement Type */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-900 mb-3">Engagement Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {REVIEW_ENGAGEMENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setReviewEngagementType(type.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        reviewEngagementType === type.value
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                          reviewEngagementType === type.value ? 'border-gray-900' : 'border-gray-300'
                        }`}>
                          {reviewEngagementType === type.value && <div className="w-2.5 h-2.5 rounded-full bg-gray-900" />}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{type.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start gap-3 text-red-600">
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Error</p>
                      <p className="text-sm">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <AntennaButton
                onClick={analyzeSOW}
                disabled={!apiKey || !file || !reviewEngagementType}
                loading={isAnalyzing}
                loadingText="Analyzing SOW..."
                className="w-full"
                size="large"
              >
                Analyze SOW
              </AntennaButton>
            </div>
          </>
        )}

        {/* Review Results View */}
        {currentView === 'review' && analysis && (
          <>
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Analysis Complete</h1>
                <p className="text-gray-500">{file?.name} • {REVIEW_ENGAGEMENT_TYPES.find(t => t.value === reviewEngagementType)?.label} Engagement</p>
              </div>
              <AntennaButton onClick={resetReview} variant="secondary" size="default">
                Review Another
              </AntennaButton>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              {analysis.critical?.length > 0 && (
                <CollapsibleSection title="Critical Issues" icon={AlertCircle} count={analysis.critical.length} defaultOpen variant="critical">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-red-600">Must be addressed before issuing to client.</p>
                    <button
                      onClick={() => toggleAllInCategory('critical', analysis.critical)}
                      className="text-xs text-gray-500 hover:text-gray-900 underline"
                    >
                      {selectedRecommendations.critical.length === analysis.critical.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  {analysis.critical.map((issue, idx) => (
                    <IssueCard 
                      key={idx} 
                      issue={issue} 
                      type="critical"
                      isSelected={selectedRecommendations.critical.includes(idx)}
                      onToggle={() => toggleRecommendation('critical', idx)}
                    />
                  ))}
                </CollapsibleSection>
              )}

              {analysis.recommended?.length > 0 && (
                <CollapsibleSection title="Recommended Improvements" icon={AlertTriangle} count={analysis.recommended.length} defaultOpen variant="recommended">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-amber-600">Would strengthen the SOW but not blocking.</p>
                    <button
                      onClick={() => toggleAllInCategory('recommended', analysis.recommended)}
                      className="text-xs text-gray-500 hover:text-gray-900 underline"
                    >
                      {selectedRecommendations.recommended.length === analysis.recommended.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  {analysis.recommended.map((issue, idx) => (
                    <IssueCard 
                      key={idx} 
                      issue={issue} 
                      type="recommended"
                      isSelected={selectedRecommendations.recommended.includes(idx)}
                      onToggle={() => toggleRecommendation('recommended', idx)}
                    />
                  ))}
                </CollapsibleSection>
              )}

              {analysis.redFlags?.length > 0 && (
                <CollapsibleSection title="Red Flags Found" count={analysis.redFlags.length} icon={AlertTriangle}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500">Problematic language to replace. Click the copy button to grab the replacement text.</p>
                    <button
                      onClick={() => toggleAllInCategory('redFlags', analysis.redFlags)}
                      className="text-xs text-gray-500 hover:text-gray-900 underline"
                    >
                      {selectedRecommendations.redFlags.length === analysis.redFlags.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  {analysis.redFlags.map((flag, idx) => (
                    <RedFlagCard 
                      key={idx} 
                      flag={flag}
                      isSelected={selectedRecommendations.redFlags.includes(idx)}
                      onToggle={() => toggleRecommendation('redFlags', idx)}
                    />
                  ))}
                </CollapsibleSection>
              )}

              {analysis.compliance && (
                <CollapsibleSection title="Structural Compliance" icon={CheckCircle}>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto font-mono text-gray-900">{analysis.compliance}</pre>
                </CollapsibleSection>
              )}

              {analysis.pricing && (
                <CollapsibleSection title="Pricing Validation" icon={DollarSign} defaultOpen>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto font-mono text-gray-900">{analysis.pricing}</pre>
                </CollapsibleSection>
              )}

              {analysis.budget && (
                <CollapsibleSection title="Budget Verification">
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto font-mono text-gray-900">{analysis.budget}</pre>
                </CollapsibleSection>
              )}

              {analysis.overall && (
                <CollapsibleSection title="Overall Assessment" defaultOpen>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto text-gray-900">{analysis.overall}</pre>
                </CollapsibleSection>
              )}

              <CollapsibleSection title="Full Analysis (Raw)">
                <pre className="whitespace-pre-wrap text-xs bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96 font-mono">{rawResponse}</pre>
              </CollapsibleSection>
            </div>

            {/* Draft Updated SOW Section */}
            <div className="mt-8 bg-gray-900 rounded-2xl p-8 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-gray-900" />
                </div>
                <div className="w-full">
                  <h2 className="text-2xl font-bold text-white mb-2">Generate Revised SOW</h2>
                  <p className="text-gray-400 mb-4">
                    Create an updated draft incorporating your selected recommendations. Use the checkboxes above to include or exclude specific changes.
                  </p>
                  
                  {/* Selection Summary */}
                  <div className="flex flex-wrap gap-3 mb-6">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border border-red-500/40 rounded-full text-red-300 text-sm">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {selectedRecommendations.critical.length}/{analysis.critical?.length || 0} Critical
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-900/30 border border-amber-500/40 rounded-full text-amber-300 text-sm">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {selectedRecommendations.recommended.length}/{analysis.recommended?.length || 0} Recommended
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-full text-gray-300 text-sm">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {selectedRecommendations.redFlags.length}/{analysis.redFlags?.length || 0} Red Flags
                    </span>
                  </div>

                  {reviewDraftError && (
                    <div className="mb-4 p-4 bg-red-900/30 border border-red-500/40 rounded-xl">
                      <p className="text-red-300 text-sm">{reviewDraftError}</p>
                    </div>
                  )}

                  {!draftedSOW ? (
                    <AntennaButton
                      onClick={generateRevisedDraft}
                      disabled={selectedRecommendations.critical.length === 0 && selectedRecommendations.recommended.length === 0 && selectedRecommendations.redFlags.length === 0}
                      loading={isDrafting}
                      loadingText="Generating Draft..."
                      icon={Sparkles}
                      variant="secondary"
                      className="bg-white hover:bg-gray-100"
                    >
                      Draft Updated SOW
                    </AntennaButton>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-900/30 border border-green-500/40 rounded-full text-green-300 text-sm font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Draft Generated
                        </span>
                        <AntennaButton
                          onClick={downloadRevisedDraft}
                          icon={Download}
                          variant="secondary"
                          size="small"
                          className="bg-white hover:bg-gray-100"
                        >
                          Download Word Doc
                        </AntennaButton>
                        <button
                          onClick={generateRevisedDraft}
                          disabled={isDrafting}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-600 transition-colors"
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {draftedSOW && (
                <div className="mt-6">
                  <div className="bg-gray-950 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-400">Revised SOW Preview</span>
                      <CopyButton text={draftedSOW} className="!bg-gray-700 !text-gray-400 hover:!bg-gray-600 hover:!text-white" />
                    </div>
                    <div className="p-4 max-h-[500px] overflow-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-100 font-mono leading-relaxed">{draftedSOW}</pre>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    <span className="text-white">[REVISED]</span> marks modified sections • <span className="text-white">[NEW]</span> marks added sections • Review carefully before use
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-20">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h3 className="text-2xl font-semibold mb-8">For conscious brands with the courage to lead</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="font-semibold mb-4 text-gray-400">Our Offices</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>San Francisco, CA</li>
                <li>New York, NY</li>
                <li>Hackensack, NJ</li>
                <li>Washington, D.C.</li>
                <li>London, UK</li>
                <li>Prague, CZ</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-400">Social</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://www.linkedin.com/company/antenna-group" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">LinkedIn</a></li>
                <li><a href="https://www.instagram.com/antennagroup/" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Instagram</a></li>
                <li><a href="https://www.facebook.com/AntennaGroup" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Facebook</a></li>
                <li><a href="https://x.com/antenna_group" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">X</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-400">Learn</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://www.antennagroup.com/lets-chat" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Let's Chat</a></li>
                <li><a href="https://www.antennagroup.com/work" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Work</a></li>
                <li><a href="https://www.antennagroup.com/age-of-adoption-podcast" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Podcast</a></li>
                <li><a href="https://fullyconscious.com" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Conscious Compass</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-400">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://www.antennagroup.com/terms" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Terms of Use</a></li>
                <li><a href="https://www.antennagroup.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-gray-800 text-sm text-gray-400">
            © 2026 Antenna Group — All Rights Reserved
          </div>
        </div>
      </footer>
    </div>
  );
}
