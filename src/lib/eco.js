// ─────────────────────────────────────────────────────────────
// EARNED CREATIVE OPPORTUNITY (ECO) MODULE, v1.0
//
// A recommendation layer that runs after attribute scoring. It reads the
// eight attribute scores plus analyst-entered evidence and never changes any
// score. It decides whether earned creative would close a real gap (the Need
// Rating), whether the brand can withstand the attention (the Appropriateness
// Gate), what outcome follows, how ambitious the work should be, and when to
// introduce HOWL, Antenna's earned creative sub-brand.
//
// Built from the ECO Module Build Packet v1.0 (September 29, 2026). Every
// weight, threshold, band, route and piece of copy lives in ECO_CONFIG; the
// functions below hold no numbers of their own. Thresholds compare unrounded
// values; round only for display. Missing inputs are excluded and the rest
// re-averaged, never scored as zero or as maximum need. Copy has no em dashes.
// ─────────────────────────────────────────────────────────────

export const ECO_CONFIG = {
  version: '1.0',

  // 5.3 Step 1
  visibility: { AWAKE: 0.45, SENTIENT: 0.35, AWARE: 0.20 },
  substance: { VISIONARY: 0.35, COGENT: 0.25, ATTENTIVE: 0.20, INTENTIONAL: 0.20 },

  // 5.3 Steps 2 and 3
  need: {
    weights: { deficit: 0.40, gap: 0.35, evidence: 0.15, context: 0.10 },
    liteWeights: { deficit: 0.533, gap: 0.467 },            // Resolution 9
    gapMultiplier: 2.5,
    gapCap: 100,
    contextPerFlag: 25,
    contextCap: 100,
    highAt: 50,
    floor: { substanceBelow: 50, capAt: 49, startupVisionaryAt: 60 },
  },

  // Primary triggers (5.3)
  triggers: {
    visibility: ['AWAKE', 'SENTIENT', 'AWARE'],
    visibilityBelow: 55,
    substance: ['VISIONARY', 'COGENT'],
    substanceAboveV: 15,
    max: 3,
    tieOrder: ['AWAKE', 'SENTIENT', 'AWARE', 'VISIONARY', 'COGENT'],   // Resolution 5
  },

  // 5.2 evidence indicators E1 to E5
  evidenceIds: ['E1', 'E2', 'E3', 'E4', 'E5'],
  e4Scale: [0, 40, 70, 100],        // 0, 1, 2, 3+ uncovered assets
  e5Scale: { none: 100, oneToTwo: 60, threePlus: 20 },
  contextIds: ['C1', 'C2', 'C3', 'C4', 'C5'],

  // 5.4 Appropriateness Gate
  gate: {
    G1: { reflective: { pass: 60, conditional: 45 }, claims: { pass: 80, conditional: 60 } },
    G2: { glassdoor: { pass: 3.7, conditional: 3.3 } },
    G4: { pass: 2, conditional: 1 },
    G5: {
      Standard: {
        intentional: { pass: 60, conditional: 45 },
        items: ['riskAppetite', 'spokesperson', 'approval', 'followThrough'],
        pass: 4, conditional: 2,
      },
      Startup: {
        intentional: { pass: 45, conditional: 35 },
        items: ['founder', 'riskAppetite', 'approval', 'deliveryPlan'],
        required: 'founder',
        pass: 3, conditional: 2,
      },
    },
    notYetConditionalCount: 3,
    reviewAtLimitedCount: 2,
  },

  checklistLabels: {
    riskAppetite: 'risk appetite',
    spokesperson: 'an available spokesperson',
    approval: 'approval within 10 working days',
    followThrough: 'a follow-through budget',
    founder: 'a founder or CEO willing to be the public face',
    deliveryPlan: 'a delivery plan scaled to the idea',
  },
  startupApprovalLabel: 'approval within 5 working days',

  // Failing criterion to services (5.4)
  routes: {
    G1: 'REFLECTIVE authenticity and reputation services; claims substantiation',
    G2: 'Reputation risk review; issues preparedness',
    G3: 'Purpose and positioning strategy',
    G4: 'COGENT data and insight services; VISIONARY innovation storytelling',
    G5: 'INTENTIONAL leadership and spokesperson development',
    stageOne: 'REFLECTIVE claims substantiation; proof-point development',   // Resolution 1
  },

  // App maturity stages (six) onto the packet's five: Pre-Foundational and
  // Foundational both take stage 1 behaviour.
  stageMap: { 'Pre-Foundational': 1, 'Foundational': 1, 'Establishing': 2, 'Differentiating': 3, 'Leading': 4, 'Transforming': 5 },

  outcomes: {
    RECOMMEND: 'Recommend',
    WITH_CONDITIONS: 'Recommend with conditions',
    BUILD: 'Build substance first',
    MOMENT: 'Moment-driven',
    NOT_PRIORITY: 'Not a current priority',
  },

  ambition: {
    A: { name: 'Evidence-led', description: 'evidence-led ideas built on your data and expertise', detail: 'Lower-risk ideas built on expertise and proprietary material.', example: 'A data release or a practical tool built on your expertise' },
    B: { name: 'Partnered', description: 'partnered ideas with credible allies', detail: 'Ideas delivered with credible partners, including cause-aligned work.', example: 'A co-created program or a cause-linked pilot' },
    C: { name: 'Bold', description: 'bold, culture-shaping work', detail: 'Provocative, culture-shaping ideas and multi-year platforms.', example: 'A public intervention or a sustained platform idea' },
  },

  copy: {
    headline: {
      'Recommend': 'Your brand is a strong candidate for earned creative.',
      'Recommend with conditions': 'Your brand is a strong candidate for earned creative, with {n} conditions to address first.',
      'Build substance first': 'Earned creative could close a real gap for your brand, once the foundations are in place.',
      'Moment-driven': 'Your brand is ready for earned creative when the right moment arrives.',
      'Not a current priority': 'Earned creative is not a priority for your brand right now.',
    },
    headlineOneCondition: 'Your brand is a strong candidate for earned creative, with 1 condition to address first.',
    why: 'Your assessment shows a gap between what {brand} does and how visible it is. Your substance score is {S} and your visibility score is {V}. {trigger_sentences}',
    triggerSentence: {
      AWAKE: '{brand} is rarely part of the category conversations it should be leading, with {E1}% of coverage driven by announcements.',
      AWAKE_noE1: '{brand} is rarely part of the category conversations it should be leading.',
      SENTIENT: "Your messaging closely resembles competitors', which makes it hard for audiences to see what sets you apart.",
      AWARE: 'Audiences show skepticism toward brand claims, so independent voices will carry more weight than your own channels.',
      VISIONARY: 'Your innovation, including {asset}, is not yet visible or understood outside the business.',
      VISIONARY_noAsset: 'Your innovation is not yet visible or understood outside the business.',
      COGENT: 'You hold data and insight, including {asset}, that could become a public proof of expertise.',
      COGENT_noAsset: 'You hold data and insight that could become a public proof of expertise.',
    },
    definition: "Earned creative is an idea designed to be talked about rather than paid to be seen. Instead of announcing something, your brand does something: a visible action, a data release, a product intervention, or a partnership that connects your work to a human truth people already care about. When the idea is strong, journalists, creators and communities carry it for you, and their voices give your brand a credibility your own channels can't.",
    appropriate: 'Your brand meets the conditions that make earned creative credible: {pass_list}. That means an idea built on your work can stand up to the attention it draws.',
    passNames: {
      G1: 'your claims are well supported',
      G2: 'your record is consistent with your message',
      G3: "you have a genuine connection to the issues you'd engage with",
      G4: 'you have distinctive, verifiable material to build on',
      G5: 'your leadership is ready to stand behind a bold idea',
    },
    conditions: {
      G1: 'Strengthen the evidence behind {unsupported_claims}.',
      G1_default: 'your central claims',
      G2: 'Resolve or prepare a clear position on {flag}.',
      G2_default: 'the issues raised in this assessment',
      G3: 'Establish a clearer link between {territory} and your business, or choose a closer territory.',
      G3_default: 'the cause territory',
      G4: 'Develop or document at least two verifiable proof points an idea could rest on.',
      G5: 'Confirm {missing_checklist_items} before ideation begins.',
      G5_intentional: 'Build leadership credibility and confidence before ideation begins.',
      G5_media: 'Complete spokesperson preparation before launch.',
    },
    rawMaterialEmpty: 'The assessment did not identify verified material yet. Building it is the first step.',
    ambitionLine: 'Level {level}: {name}. {detail} For example: {example}.',
    howlOpeners: {
      standard: 'Most brands have more to say than the world has heard. HOWL exists to change that.',
      sustainability: 'Sustainability has been whispering whilst the world has been scrolling. HOWL exists to change that.',
      startup: "Breakout brands can't outspend incumbents. They can outthink them. HOWL exists to help them do it.",
    },
    howlFull: "{opener}\n\nHOWL is Antenna Group's sub-brand for bold earned creative. We give brands edge, not echo: ideas built on what you actually do, designed to create a head snap that makes journalists, creators and communities want to talk about you.\n\nEvery HOWL idea starts with evidence, and this assessment has already found ours: {raw_material_short}. At your current stage, we'd start with {ambition_description}.",
    howlFullNoMaterial: "{opener}\n\nHOWL is Antenna Group's sub-brand for bold earned creative. We give brands edge, not echo: ideas built on what you actually do, designed to create a head snap that makes journalists, creators and communities want to talk about you.\n\nEvery HOWL idea starts with evidence. At your current stage, we'd start with {ambition_description}.",
    howlShort: {
      'Moment-driven': "When the right moment arrives, HOWL, Antenna Group's earned creative sub-brand, can turn it into an idea people talk about. We'll flag the moments worth acting on.",
      'Build substance first': "Once the foundations are in place, HOWL, Antenna Group's earned creative sub-brand, can turn them into ideas that earn attention. The work recommended above is the first step.",
    },
    next: {
      'Recommend': 'Next step: a HOWL ideation session built on the material above.',
      'Recommend with conditions': 'Next step: a HOWL ideation session built on the material above.',
      'Build substance first': 'Next step: {routed_services}, with earned creative as the follow-on.',
      'Moment-driven': "Next step: we'll flag earned creative opportunities as relevant moments arise.",
      'Not a current priority': 'Next step: focus on the priority recommendations elsewhere in this report.',
    },
    floorNote: 'Limited raw material: build verifiable proof points before earned creative can carry the brand.',
    reviewNote: 'Two or more gate criteria rest on limited evidence. Review before this recommendation goes to the client.',
    overrideRejected: 'This override is not allowed: {criteria} failed, and earned creative cannot be recommended while the brand would not withstand the attention. Address it first.',
  },

  // 5.8 benefit statements
  benefits: {
    AWAKE: { text: 'Earned creative can move {brand} from reacting to category conversations to leading them, with a proof point journalists and peers return to.', metric: 'Share of voice; idea-driven stories in priority outlets' },
    SENTIENT: { text: "A distinctive act gives {brand} a point of view competitors can't easily copy, where messaging alone tends to blend into the category.", metric: 'Unaided association with a defined idea; organic mentions' },
    AWARE: { text: 'Independent voices carry more weight with skeptical audiences than brand claims, so earned attention builds trust your own channels struggle to reach.', metric: 'Trust and sentiment scores; third-party endorsements' },
    VISIONARY: { text: 'Your innovation becomes visible and understood, positioning {brand} as a future leader rather than a quiet contributor.', metric: 'Coverage of named innovations; analyst and investor mentions' },
    COGENT: { text: 'Your data and insight become a public asset that demonstrates expertise and generates repeatable coverage.', metric: 'Citations of brand data; repeat coverage' },
    General: { text: 'Earned creative can deliver reach well beyond what the same budget buys in paid media, and it creates assets that keep working long after launch.', metric: 'Earned reach vs spend; asset reuse' },
    cause: "Connecting your work to an issue your audiences care about can deepen loyalty and invite participation, provided the brand's role is to contribute, with the cause and the people affected at the center.",
  },

  // Earned creative already in use (framework 2.11): a brand with at least one
  // confirmed activation gets a small lift to SENTIENT and INTENTIONAL, once,
  // however many activations, capped at 100. It stacks with the campaign
  // coherence modifier. This is the only part of the module that moves scores.
  usageLift: { attributes: ['SENTIENT', 'INTENTIONAL'], points: 3, cap: 100 },

  // 5.7 which blocks show for which outcome
  blocks: {
    headline: 'all',
    why: ['Recommend', 'Recommend with conditions', 'Build substance first'],
    definition: 'all',
    benefits: ['Recommend', 'Recommend with conditions', 'Moment-driven'],
    appropriate: ['Recommend', 'Recommend with conditions'],
    conditions: ['Recommend with conditions', 'Build substance first'],      // plus Moment-driven when the gate is Conditional
    rawMaterial: ['Recommend', 'Recommend with conditions', 'Build substance first', 'Moment-driven'],
    ambition: ['Recommend', 'Recommend with conditions', 'Moment-driven'],
    howl: ['Recommend', 'Recommend with conditions', 'Moment-driven', 'Build substance first'],
    next: 'all',
  },
};

const C = ECO_CONFIG;
const O = C.outcomes;
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
const weighted = (weights, attrs) => Object.entries(weights).reduce((sum, [k, w]) => sum + w * (num(attrs[k]) ?? 0), 0);
const worse = (a, b) => (a === 'Fail' || b === 'Fail' ? 'Fail' : a === 'Conditional' || b === 'Conditional' ? 'Conditional' : 'Pass');
const band3 = (v, { pass, conditional }) => (v >= pass ? 'Pass' : v >= conditional ? 'Conditional' : 'Fail');
const listJoin = (arr) => (arr.length < 2 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
export const round1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

// Map the app's six maturity stages onto the packet's five.
export const ecoStageFor = (stageName) => C.stageMap[stageName] ?? null;
// Startup profile from the app's company stage; the analyst can override.
export const ecoProfileFor = (companyStageId, override = null) => override || (companyStageId === 'startup' ? 'Startup' : 'Standard');

// ── 5.3 Visibility, Substance and the four components ───────
export function computeScores(attrs, evidence = {}, context = {}, { lite = false } = {}) {
  const V = weighted(C.visibility, attrs);
  const S = weighted(C.substance, attrs);
  const deficit = 100 - V;
  const gap = Math.min(C.need.gapCap, Math.max(0, S - V) * C.need.gapMultiplier);
  const ev = lite ? [] : C.evidenceIds.map(id => num(evidence[id])).filter(v => v !== null);
  const evidenceScore = ev.length ? ev.reduce((a, b) => a + b, 0) / ev.length : null;
  const flags = lite ? null : C.contextIds.filter(id => context[id] === true).length;
  const contextScore = lite ? null : Math.min(C.need.contextCap, flags * C.need.contextPerFlag);
  return { visibility: V, substance: S, deficit, gap, evidence: evidenceScore, context: contextScore };
}

// ── 5.3 Need Rating, band, substance floor, primary triggers ─
export function computeNeed(scores, attrs, profile = 'Standard', { lite = false } = {}) {
  const w = lite ? C.need.liteWeights : C.need.weights;
  const parts = [['deficit', scores.deficit], ['gap', scores.gap], ['evidence', scores.evidence], ['context', scores.context]]
    .filter(([k, v]) => w[k] !== undefined && v !== null && v !== undefined);
  const total = parts.reduce((s, [k]) => s + w[k], 0);
  const uncapped = parts.reduce((s, [k, v]) => s + w[k] * v, 0) / total;
  const floorFires = scores.substance < C.need.floor.substanceBelow
    && !(profile === 'Startup' && (num(attrs.VISIONARY) ?? 0) >= C.need.floor.startupVisionaryAt);
  const needRating = floorFires ? Math.min(uncapped, C.need.floor.capAt) : uncapped;
  const needBand = needRating >= C.need.highAt ? 'High' : 'Low';

  const t = C.triggers;
  const cands = [];
  t.visibility.forEach(k => { const v = num(attrs[k]); if (v !== null && v < t.visibilityBelow) cands.push({ id: k, gap: t.visibilityBelow - v }); });
  t.substance.forEach(k => { const v = num(attrs[k]); if (v !== null && v - scores.visibility >= t.substanceAboveV) cands.push({ id: k, gap: v - scores.visibility }); });
  cands.sort((a, b) => (b.gap - a.gap) || (t.tieOrder.indexOf(a.id) - t.tieOrder.indexOf(b.id)));
  return { needRating, uncappedNeed: uncapped, needBand, substanceFloorApplied: floorFires, primaryTriggers: cands.slice(0, t.max).map(c => c.id) };
}

// ── 5.4 Appropriateness Gate ─────────────────────────────────
// Inputs (analyst panel): claimsPct, flags [{ label, major, resolved }],
// glassdoor, causeTerritory ({ name, link: 'direct'|'adjacent'|'none' } or
// null), verifiedTruths [{ name, description }], checklist { item: bool }
// (null when not answered), mediaTrained (startups), unsupportedClaims.
// A criterion with none of its inputs available is 'Pending': the gate can't
// be decided until the analyst has entered it.
export function evaluateGate(attrs, inputs = {}, profile = 'Standard') {
  const g = C.gate;
  const criteria = {};

  // G1 Proof threshold (hard)
  {
    const refl = num(attrs.REFLECTIVE);
    const claims = num(inputs.claimsPct);
    const tests = [];
    if (refl !== null) tests.push(band3(refl, g.G1.reflective));
    if (claims !== null) tests.push(band3(claims, g.G1.claims));
    criteria.G1 = tests.length
      ? { result: tests.reduce(worse), limitedEvidence: tests.length < 2 }
      : { result: 'Pending', limitedEvidence: true };
  }

  // G2 Conduct consistency (hard). Flags are always known: no flags entered
  // means none were found. Glassdoor may be missing.
  {
    const flags = Array.isArray(inputs.flags) ? inputs.flags : [];
    const flagResult = flags.some(f => f.major && !f.resolved) ? 'Fail' : flags.length ? 'Conditional' : 'Pass';
    const gd = num(inputs.glassdoor);
    const result = gd === null ? flagResult : worse(flagResult, band3(gd, g.G2.glassdoor));
    criteria.G2 = { result, limitedEvidence: gd === null, flags: flags.map(f => f.label) };
  }

  // G3 Right to play
  {
    const t = inputs.causeTerritory;
    if (!t || !t.name) criteria.G3 = { result: 'Pass', causeTerritory: false, limitedEvidence: false };   // Resolution 6
    else criteria.G3 = { result: t.link === 'direct' ? 'Pass' : t.link === 'adjacent' ? 'Conditional' : 'Fail', causeTerritory: true, territory: t.name, limitedEvidence: false };
  }

  // G4 Raw material
  {
    const truths = Array.isArray(inputs.verifiedTruths) ? inputs.verifiedTruths : null;
    criteria.G4 = truths === null
      ? { result: 'Pending', verifiedTruths: [], limitedEvidence: true }
      : { result: truths.length >= g.G4.pass ? 'Pass' : truths.length >= g.G4.conditional ? 'Conditional' : 'Fail', verifiedTruths: truths.map(x => x.name), limitedEvidence: false };
  }

  // G5 Organizational readiness, by profile
  {
    const p = g.G5[profile] || g.G5.Standard;
    const intent = num(attrs.INTENTIONAL);
    const cl = inputs.checklist && typeof inputs.checklist === 'object' ? inputs.checklist : null;
    const tests = [];
    let missing = [];
    let requiredMissing = false;
    if (intent !== null) tests.push(band3(intent, p.intentional));
    if (cl) {
      const have = p.items.filter(i => cl[i] === true).length;
      missing = p.items.filter(i => cl[i] !== true);
      requiredMissing = !!p.required && cl[p.required] !== true;
      tests.push(requiredMissing ? 'Fail' : have >= p.pass ? 'Pass' : have >= p.conditional ? 'Conditional' : 'Fail');
    }
    let result = tests.length ? tests.reduce(worse) : 'Pending';
    // For startups, missing media training is a condition, not a failure.
    const mediaCondition = profile === 'Startup' && inputs.mediaTrained === false;
    if (mediaCondition && result === 'Pass') result = 'Conditional';
    criteria.G5 = {
      result, profile, limitedEvidence: tests.length < 2,
      missing: missing.map(i => (profile === 'Startup' && i === 'approval' ? C.startupApprovalLabel : C.checklistLabels[i])),
      intentionalResult: intent !== null ? band3(intent, p.intentional) : null,
      mediaCondition,
    };
  }

  const results = Object.values(criteria).map(c => c.result);
  const conditionals = results.filter(r => r === 'Conditional').length;
  const limited = Object.values(criteria).filter(c => c.limitedEvidence).length;
  let result;
  if (results.includes('Pending')) result = 'Pending';
  else if (results.includes('Fail') || conditionals >= g.notYetConditionalCount) result = 'Not yet';
  else if (conditionals > 0) result = 'Conditional';
  else result = 'Pass';
  return { result, criteria, analystReviewRequired: limited >= g.reviewAtLimitedCount || result === 'Pending' };
}

export const hardFailures = (gate) => ['G1', 'G2'].filter(id => gate.criteria[id]?.result === 'Fail');

// ── 5.5 Decision matrix, with the stage 1 rule (Resolution 1) ─
export function decideOutcome(needBand, gate, maturityStage, profile = 'Standard') {
  if (gate.result === 'Pending') return { outcome: null, routedServices: [] };
  let outcome;
  if (needBand === 'High') outcome = gate.result === 'Pass' ? O.RECOMMEND : gate.result === 'Conditional' ? O.WITH_CONDITIONS : O.BUILD;
  else outcome = gate.result === 'Not yet' ? O.NOT_PRIORITY : O.MOMENT;

  let routedServices = [];
  if (outcome === O.BUILD) {
    routedServices = Object.entries(gate.criteria).filter(([, c]) => c.result === 'Fail').map(([id]) => C.routes[id]);
    // Three or more Conditionals with no Fail: route the conditional criteria.
    if (!routedServices.length) routedServices = Object.entries(gate.criteria).filter(([, c]) => c.result === 'Conditional').map(([id]) => C.routes[id]);
  }
  if ((outcome === O.RECOMMEND || outcome === O.WITH_CONDITIONS) && maturityStage === 1 && profile !== 'Startup') {
    outcome = O.BUILD;
    routedServices = [C.routes.stageOne];
  }
  return { outcome, routedServices };
}

// ── 5.6 Ambition level (Resolutions 2 and 4) ─────────────────
export function calibrateAmbition(outcome, gateResult, maturityStage, profile = 'Standard') {
  if (![O.RECOMMEND, O.WITH_CONDITIONS, O.MOMENT].includes(outcome)) return null;
  const pass = gateResult === 'Pass';
  if (profile === 'Startup' && maturityStage <= 2) return pass ? 'B' : 'A';
  switch (maturityStage) {
    case 1: return null;
    case 2: return 'A';
    case 3: return pass ? 'B' : 'A';
    case 4: return pass ? 'C' : 'B';
    case 5: return pass ? 'C' : 'B';
    default: return null;
  }
}

// ── 5.8 Benefit statements ───────────────────────────────────
export function routeBenefits(outcome, triggers, { brand = 'your brand', cause = false, stakeholder = null } = {}) {
  const pick = outcome === O.MOMENT ? [] : triggers.slice(0, C.triggers.max);
  const out = pick.map(id => ({ trigger: id, ...C.benefits[id] }));
  out.push({ trigger: 'General', ...C.benefits.General });
  if (cause) out.push({ trigger: 'Cause', text: C.benefits.cause, metric: null });
  return out.map(b => {
    let text = fill(b.text, { brand });
    if (stakeholder) text = text.replace(/\baudiences\b/g, stakeholder).replace(/\bAudiences\b/g, stakeholder.charAt(0).toUpperCase() + stakeholder.slice(1));
    return { ...b, text };
  });
}

// ── 5.7 block 9: HOWL length and opener (Resolution 7) ───────
export function selectHowlIntro(outcome, { profile = 'Standard', causeTerritory = false, c5 = false, openerOverride = null } = {}) {
  let length = null;
  if (outcome === O.RECOMMEND || outcome === O.WITH_CONDITIONS) length = 'full';
  else if (outcome === O.MOMENT || outcome === O.BUILD) length = 'short';
  if (!length) return null;
  const opener = openerOverride || (profile === 'Startup' ? 'startup' : (causeTerritory || c5) ? 'sustainability' : 'standard');
  return { length, opener };
}

// ── 5.10 Analyst overrides (Resolution 8) ────────────────────
export function validateOverride(override, gate) {
  if (!override) return { ok: true };
  if (!override.reason || !String(override.reason).trim()) return { ok: false, message: 'An override needs a reason.' };
  const hard = hardFailures(gate);
  if (hard.length && [O.RECOMMEND, O.WITH_CONDITIONS].includes(override.outcome)) {
    return { ok: false, message: fill(C.copy.overrideRejected, { criteria: listJoin(hard.map(id => (id === 'G1' ? 'G1 Proof threshold' : 'G2 Conduct consistency'))) }) };
  }
  return { ok: true };
}

// ── The whole module, to the 5.9 data model ──────────────────
// input: { attrs, evidence, context, gateInputs, maturityStage, profile,
//          openerOverride, stakeholder, override, lite }
export function runEco(input) {
  const { attrs, evidence = {}, context = {}, gateInputs = {}, maturityStage, profile = 'Standard', lite = false } = input;
  const scores = computeScores(attrs, evidence, context, { lite });
  const need = computeNeed(scores, attrs, profile, { lite });
  const gate = lite
    ? { result: 'Requires full assessment', criteria: {}, analystReviewRequired: false }
    : evaluateGate(attrs, gateInputs, profile);
  let { outcome, routedServices } = lite ? { outcome: null, routedServices: [] } : decideOutcome(need.needBand, gate, maturityStage, profile);
  let ambitionLevel = calibrateAmbition(outcome, gate.result, maturityStage, profile);

  let override = null;
  let overrideRejected = null;
  if (input.override && !lite) {
    const v = validateOverride(input.override, gate);
    if (v.ok) {
      override = { ...input.override };
      if (override.outcome) {
        outcome = override.outcome;
        ambitionLevel = calibrateAmbition(outcome, gate.result, maturityStage, profile);
        if (outcome !== O.BUILD) routedServices = [];
      }
      if (override.ambitionLevel !== undefined) ambitionLevel = override.ambitionLevel;
    } else {
      overrideRejected = v.message;
    }
  }

  const causeTerritory = !!gate.criteria?.G3?.causeTerritory;
  const howlIntro = selectHowlIntro(outcome, { profile, causeTerritory, c5: context.C5 === true, openerOverride: input.openerOverride });

  return {
    version: C.version,
    businessProfile: profile,
    scores,
    needRating: need.needRating,
    uncappedNeed: need.uncappedNeed,
    needBand: need.needBand,
    substanceFloorApplied: need.substanceFloorApplied,
    primaryTriggers: need.primaryTriggers,
    gate,
    outcome,
    maturityStage,
    ambitionLevel,
    routedServices,
    howlIntro,
    analystReviewRequired: !!gate.analystReviewRequired,
    override,
    overrideRejected,
    lite,
  };
}

// ── 5.7 Report blocks ────────────────────────────────────────
// ctx: { brand, evidence, gateInputs, e4Assets [{ name, description }],
//        stakeholder, context }
export function buildReportSection(eco, ctx = {}) {
  const brand = ctx.brand || 'your brand';
  const o = eco.outcome;
  const shows = (key) => {
    const rule = C.blocks[key];
    if (rule === 'all') return true;
    if (key === 'conditions' && o === O.MOMENT && eco.gate.result === 'Conditional') return true;   // Resolution 3
    return rule.includes(o);
  };
  const blocks = [];
  const crit = eco.gate.criteria || {};
  const conditionLines = [];
  Object.entries(crit).forEach(([id, c]) => {
    if (c.result !== 'Conditional' && c.result !== 'Fail') return;
    const cc = C.copy.conditions;
    if (id === 'G1') conditionLines.push(fill(cc.G1, { unsupported_claims: ctx.gateInputs?.unsupportedClaims || cc.G1_default }));
    if (id === 'G2') conditionLines.push(fill(cc.G2, { flag: c.flags?.[0] || cc.G2_default }));
    if (id === 'G3') conditionLines.push(fill(cc.G3, { territory: c.territory || cc.G3_default }));
    if (id === 'G4') conditionLines.push(cc.G4);
    if (id === 'G5') {
      if (c.missing?.length) conditionLines.push(fill(cc.G5, { missing_checklist_items: listJoin(c.missing) }));
      else if (c.intentionalResult && c.intentionalResult !== 'Pass') conditionLines.push(cc.G5_intentional);
      if (c.mediaCondition) conditionLines.push(cc.G5_media);
    }
  });
  const conditionCount = Object.values(crit).filter(c => c.result === 'Conditional' || c.result === 'Fail').length;

  const truths = ctx.gateInputs?.verifiedTruths || [];
  const assets = ctx.e4Assets || [];
  const material = [...truths, ...assets.filter(a => !truths.some(t => t.name === a.name))];

  if (shows('headline')) {
    const text = o === O.WITH_CONDITIONS && conditionCount === 1 ? C.copy.headlineOneCondition : fill(C.copy.headline[o] || '', { n: conditionCount });
    blocks.push({ id: 'headline', text });
  }
  if (shows('why')) {
    const e1 = num(ctx.evidence?.E1);
    // VISIONARY and COGENT each cite the next asset in turn, so two
    // triggers never name the same one.
    let nextAsset = 0;
    const sentences = eco.primaryTriggers.map(id => {
      const ts = C.copy.triggerSentence;
      if (id === 'AWAKE') return fill(e1 === null ? ts.AWAKE_noE1 : ts.AWAKE, { brand, E1: e1 === null ? '' : Math.round(e1) });
      if (id === 'VISIONARY' || id === 'COGENT') {
        const asset = material[nextAsset]?.name;
        if (asset) nextAsset += 1;
        return fill(asset ? ts[id] : ts[`${id}_noAsset`], { asset: asset || '' });
      }
      return fill(ts[id], { brand });
    });
    blocks.push({ id: 'why', title: "Why we're flagging this",
      text: fill(C.copy.why, { brand, S: round1(eco.scores.substance), V: round1(eco.scores.visibility), trigger_sentences: sentences.join(' ') }).trim() });
  }
  if (shows('definition')) blocks.push({ id: 'definition', title: 'What earned creative is', text: C.copy.definition });
  if (shows('benefits')) {
    const cause = !!crit.G3?.causeTerritory || ctx.context?.C5 === true;
    blocks.push({ id: 'benefits', title: 'What it could do for your brand', items: routeBenefits(o, eco.primaryTriggers, { brand, cause, stakeholder: ctx.stakeholder || null }) });
  }
  if (shows('appropriate')) {
    const passing = Object.entries(crit).filter(([, c]) => c.result === 'Pass').map(([id]) => C.copy.passNames[id]);
    blocks.push({ id: 'appropriate', title: "Why it's appropriate now", text: fill(C.copy.appropriate, { pass_list: listJoin(passing) }) });
  }
  if (shows('conditions') && conditionLines.length) blocks.push({ id: 'conditions', title: 'What would need to be true', items: conditionLines });
  if (shows('rawMaterial')) {
    blocks.push({ id: 'rawMaterial', title: 'Where the raw material is',
      items: material.length ? material.map(m => `${m.name}: ${String(m.description || '').replace(/\.$/, '')}.`) : null,
      text: material.length ? null : C.copy.rawMaterialEmpty });
  }
  if (shows('ambition') && eco.ambitionLevel) {
    const a = C.ambition[eco.ambitionLevel];
    blocks.push({ id: 'ambition', title: 'Recommended ambition level', level: eco.ambitionLevel,
      text: fill(C.copy.ambitionLine, { level: eco.ambitionLevel, name: a.name, detail: a.detail, example: a.example }) });
  }
  if (shows('howl') && eco.howlIntro) {
    const opener = C.copy.howlOpeners[eco.howlIntro.opener];
    let text;
    if (eco.howlIntro.length === 'full') {
      const short = truths.slice(0, 2).map(t => t.name);
      const amb = eco.ambitionLevel ? C.ambition[eco.ambitionLevel].description : C.ambition.A.description;
      text = fill(short.length ? C.copy.howlFull : C.copy.howlFullNoMaterial, { opener, raw_material_short: listJoin(short), ambition_description: amb });
    } else {
      text = C.copy.howlShort[o];
    }
    blocks.push({ id: 'howl', title: 'Introducing HOWL', length: eco.howlIntro.length, opener: eco.howlIntro.opener, text });
  }
  if (shows('next')) blocks.push({ id: 'next', text: fill(C.copy.next[o] || '', { routed_services: listJoin(eco.routedServices) }) });
  return blocks;
}

// The quick (lite) view for the Teaser read (5.11): verdict, definition, and
// HOWL with the standard opener. The gate needs the full assessment.
export function buildLiteSection(attrs) {
  const eco = runEco({ attrs, lite: true });
  const verdict = eco.needBand === 'High'
    ? 'Earned creative could close a real gap for this brand. The full assessment confirms whether it can withstand the attention.'
    : 'Earned creative is optional for this brand today, and could still suit the right moment. The full assessment confirms it.';
  return { eco, blocks: [
    { id: 'headline', text: verdict },
    { id: 'definition', title: 'What earned creative is', text: C.copy.definition },
    { id: 'howl', title: 'Introducing HOWL', length: 'lite', opener: 'standard', text: C.copy.howlOpeners.standard },
    { id: 'gate', text: 'Appropriateness: requires full assessment.' },
  ] };
}

// ── Earned creative in use: the score lift (framework 2.11) ──
// The scoring pass lists the activations it finds in the earned media and
// social readouts; the analyst can remove any (removed: true). The lift is
// applied in code, never by the model, and recomputed from the base and the
// campaign modifier every time, so applying it twice never double counts and
// removing every activation takes it away again.
export function parseActivations(raw) {
  const list = Array.isArray(raw?.activations) ? raw.activations : Array.isArray(raw) ? raw : [];
  return list
    .filter(a => a && typeof a === 'object' && String(a.name || '').trim())
    .map(a => ({ name: String(a.name).trim(), what: String(a.what || '').trim(), evidence: String(a.evidence || '').trim(), removed: a.removed === true }));
}

export function applyEarnedCreativeLift(scores, frameworkVersion = null) {
  if (!scores) return scores;
  const activations = parseActivations(scores.earnedCreative);
  const confirmed = activations.filter(a => !a.removed).length;
  const lift = confirmed > 0 ? C.usageLift.points : 0;
  const out = { ...scores };
  C.usageLift.attributes.forEach(id => {
    const e = out[id];
    if (!e || (typeof e.score !== 'number' && typeof e.baseScore !== 'number')) return;
    const base = typeof e.baseScore === 'number' ? e.baseScore : e.score;
    const withCampaign = Math.max(0, Math.min(100, base + (Number(e.campaignModifierApplied) || 0)));
    const adjusted = Math.min(C.usageLift.cap, withCampaign + lift);
    out[id] = { ...e, baseScore: base, earnedCreativeLift: lift, earnedCreativeLiftApplied: adjusted - withCampaign, score: adjusted };
  });
  out.earnedCreative = { ...(scores.earnedCreative || {}), activations, confirmedCount: confirmed, liftApplied: lift > 0, ...(frameworkVersion ? { frameworkVersion } : {}) };
  return out;
}

// ── From a saved report to the module's result ───────────────
// The analyst's inputs live on the report as scores.eco (JSONB, no
// migration). The panel collects plain facts; the evidence scores are derived
// here so the arithmetic stays in one place:
//   E1  % of coverage triggered by announcements (entered directly)
//   E2  100 minus the brand's share of voice as a % of the leader's, floor 0
//   E3  100 minus the % of mentions not prompted by the brand
//   E4  from the count of uncovered assets (0, 1, 2, 3+)
//   E5  from the count of idea-driven stories in priority outlets
// Anything left blank is missing, and missing is excluded, never zero.
export function ecoEvidence(state = {}) {
  const n = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
  const e = {};
  if (n(state.announcementPct) !== null) e.E1 = Math.max(0, Math.min(100, n(state.announcementPct)));
  if (n(state.sovVsLeaderPct) !== null) e.E2 = Math.max(0, 100 - n(state.sovVsLeaderPct));
  if (n(state.organicPct) !== null) e.E3 = Math.max(0, Math.min(100, 100 - n(state.organicPct)));
  const assets = Array.isArray(state.e4Assets) ? state.e4Assets.filter(a => String(a?.name || '').trim()) : [];
  if (assets.length || state.e4NoneFound) e.E4 = C.e4Scale[Math.min(assets.length, C.e4Scale.length - 1)];
  const stories = n(state.ideaStories);
  if (stories !== null) e.E5 = stories === 0 ? C.e5Scale.none : stories <= 2 ? C.e5Scale.oneToTwo : C.e5Scale.threePlus;
  return { evidence: e, assets };
}

export function ecoFromReport(scores, { brand, companyStage, stageName }) {
  const state = scores?.eco || {};
  const attrs = Object.fromEntries(['AWAKE', 'SENTIENT', 'AWARE', 'VISIONARY', 'COGENT', 'ATTENTIVE', 'INTENTIONAL', 'REFLECTIVE'].map(id => [id, scores?.[id]?.score]));
  const { evidence, assets } = ecoEvidence(state);
  const clean = (list) => (Array.isArray(list) ? list.filter(x => String(x?.name || x?.label || '').trim()) : null);
  const gateInputs = {
    claimsPct: state.claimsPct,
    unsupportedClaims: state.unsupportedClaims || '',
    flags: clean(state.flags) || [],
    glassdoor: state.glassdoor,
    causeTerritory: String(state.causeName || '').trim() ? { name: state.causeName.trim(), link: state.causeLink || 'adjacent' } : null,
    verifiedTruths: state.truthsEntered ? (clean(state.verifiedTruths) || []) : null,
    checklist: state.checklistEntered ? (state.checklist || {}) : null,
    mediaTrained: state.mediaTrained === undefined ? undefined : state.mediaTrained,
  };
  const profile = ecoProfileFor(companyStage, state.profile || null);
  const result = runEco({
    attrs, evidence, context: state.context || {}, gateInputs,
    maturityStage: ecoStageFor(stageName), profile,
    openerOverride: state.openerOverride || null, override: state.override || null,
  });
  const blocks = result.outcome
    ? buildReportSection(result, { brand, evidence, gateInputs, e4Assets: assets, stakeholder: state.stakeholder || null, context: state.context || {} })
    : [];
  return { result, blocks, evidence, gateInputs, profile, state };
}
