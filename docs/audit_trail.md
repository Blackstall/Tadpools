# Tadpools v2 – Context-Aware Fraud Intelligence System

---

## 🎯 Objective

Transform Tadpools from a document verification tool into a **Context-Aware Fraud Decision Intelligence System** that supports real operational workflows.

The system must:
- Reduce manual data entry
- Integrate multi-source context (not just documents)
- Provide explainable AI recommendations
- Ensure **human-in-the-loop decision making**
- Minimize risk of incorrect automated decisions

---

## 🧠 Core Principle

Tadpools v2 is NOT an automated decision system.

> AI provides structured intelligence.  
> Humans make the final decision.

---

## 🏗️ System Architecture

### 1. Input Layer

Minimal friction input system.

#### Required:
- Company Name OR
- Registration Number OR
- Bank Account Number

#### Optional (Expandable Section):
- Officer Notes (free text)
- Call Summary
- Observations (checkbox + text)

#### Features:
- Smart Search Bar (auto suggestion + matching)
- Document Upload (drag & drop)
- Context Panel (collapsible)

---

### 2. Processing Layer

#### A. Auto Extraction Engine
- Extract fields from documents:
  - Company Name
  - Registration Number
  - Account Number
  - Director / Beneficiary Names

- Output:
  - Structured JSON
  - Confidence score per field

---

#### B. Entity Resolution Engine
- Match inputs against:
  - Internal database
  - External-ready sources (CTOS / SSM)

- Return:
  - Match candidates
  - Confidence %

---

### 3. Agent Layer (Tadpoles)

Each agent produces **signals**, NOT decisions.

#### Agent Types:

1. Identity Tadpole
   - Validates entity existence
   - Cross-checks registry

2. Document Tadpole
   - Validates extracted data
   - Detects anomalies

3. Pattern Tadpole
   - Matches known fraud patterns
   - Mule account detection

4. Behavior Tadpole
   - Analyzes officer notes
   - Flags suspicious context

---

### 4. Decision Intelligence Layer

Aggregates signals into AI recommendation.

#### AI Output:
- Risk Score (0–100)
- Risk Level:
  - Low
  - Medium
  - High

#### Key Signals:
- Ranked by impact
- Traceable to agents

#### Confidence Score:
- Indicates reliability of AI output

---

## 🔒 Human-in-the-Loop Decision Framework

### Principle

AI must NOT make final decisions.

AI provides:
- Risk scoring
- Recommendations
- Supporting evidence

Final decision must be made by the officer.

---

### Decision Flow

1. AI generates:
   - Risk score
   - Recommendation
   - Key signals

2. Officer reviews:
   - AI reasoning
   - Supporting context

3. Officer selects:
   - Approve / Escalate / Reject

4. Officer provides justification (MANDATORY)

---

### Safeguards

#### Confidence-Based Handling:
- >85% → Strong recommendation
- 60–85% → Needs review
- <60% → Force manual verification warning

#### Conflict Detection:
If officer decision ≠ AI recommendation:

Display warning:
"Your decision differs from AI recommendation. Proceed?"

---

### Audit Logging

Every decision must be stored:

```json
{
  "ai_recommendation": "",
  "risk_score": 0,
  "officer_decision": "",
  "justification": "",
  "confidence": 0,
  "timestamp": ""
}
🖥️ UI/UX DESIGN SPEC
Layout Structure (3-PANEL SYSTEM)
LEFT PANEL – INPUT
Sections:
Smart Search
Single input
Auto-suggestion dropdown
Document Upload
Drag & drop
Auto parsing indicator
Context Input (Collapsible)
Officer Notes
Call Summary
Observations

👉 Keep minimal by default

CENTER PANEL – TADPOLE ARENA

Signature visual system.

Design:
Open canvas
Nodes representing agents:
Identity
Document
Pattern
Behavior
Behavior:
Tadpoles move between nodes
Nodes light up during processing
Interaction:
Click node → full reasoning
Hover → summary
RIGHT PANEL – DECISION & ACTION
SECTION 1: AI RECOMMENDATION

Display:

Risk Score (large)
Risk Level (color-coded)

Example:
"AI Risk Score: 82 (High Risk)"

SECTION 2: KEY SIGNALS

Bullet points:

Company not found in registry
Account mismatch
Pattern similarity detected
SECTION 3: AGENT BREAKDOWN

Expandable cards:

Agent Name
Findings
Confidence
Reasoning logs
SECTION 4: OFFICER DECISION (MANDATORY)

Buttons:

Approve
Escalate
Reject

Required:

Justification text input
SECTION 5: CONFLICT ALERT (Conditional)

If mismatch:

"⚠️ Your decision differs from AI recommendation."

SECTION 6: AUDIT TRAIL

Timeline:

Input received
Processing steps
Agent execution
Decision made
⚡ UX PRINCIPLES
Minimal required input
AI suggests, human confirms
No blind automation
Full transparency
Operational clarity over complexity
🔄 USER FLOW
Officer inputs minimal identifier OR uploads document
System auto extracts + suggests matches
Officer confirms / edits
Optional context added
Tadpoles process signals
AI produces recommendation
Officer makes final decision + justification
System logs everything
📊 DATA STRUCTURE
{
  "input": {},
  "extracted": {},
  "agents": [],
  "ai_output": {
    "risk_score": 0,
    "risk_level": "",
    "confidence": 0,
    "signals": []
  },
  "human_decision": {
    "decision": "",
    "justification": ""
  }
}
🧪 MVP IMPLEMENTATION PLAN
Phase 1 (Demo)
Static UI
Mock smart search
Simulated tadpoles
Hardcoded AI signals
Phase 2
OCR integration
Basic matching logic
Scoring system
Phase 3
External APIs (CTOS / SSM ready)
Real agent orchestration
Feedback learning loop
🚀 POSITIONING (FOR PRESENTATION)

Use this line:

"Tadpools v2 is a decision intelligence system that consolidates fragmented verification processes into one explainable, human-controlled workflow."

⚠️ FINAL NOTE

This system must:

Assist, not replace
Explain, not obscure
Reduce risk, not introduce new ones