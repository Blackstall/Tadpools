# Tadpools UI/UX Improvement Plan
## Goal
Transform Tadpools from a visually interesting prototype into a clean, structured, Mirofish-inspired swarm investigation workspace for fraud onboarding and safe KYC recommendation.

This document gives step-by-step implementation instructions.

---

# Core Objective

Build Tadpools as:

- a **living fraud investigation workspace**
- a **structured swarm intelligence interface**
- a **clear onboarding decision system**
- a **privacy-aware document processing system**

The final product should allow users to:

1. input company and beneficiary data
2. upload supporting documents
3. watch documents get processed temporarily
4. see tadpoles swarm, inspect, discuss, and decide
5. receive an explainable onboarding outcome

---

# High-Level Design Direction

Adopt a layout philosophy similar to Mirofish:

- **Left panel** = context and controls
- **Center canvas** = main visual swarm pool
- **Right panel** = intelligence, documents, findings, decision

Main difference:
- Mirofish visualizes relationship graphs
- Tadpools visualizes swarm-based fraud review

The system should feel:
- clean
- premium
- structured
- alive
- explainable

---

# Phase 1 — Fix the Overall Layout

## Step 1. Rebuild the page into a 3-column structure

### Required layout
- Left Sidebar
- Main Center Workspace
- Right Intelligence Panel

### Left Sidebar should contain
- Tadpools logo
- tagline
- case status
- step progress
- agent legend
- optional quick case summary

### Center Workspace should contain
- top: The Pool (main animated area)
- bottom: Intake Dock (form + upload + consent + action button)

### Right Panel should contain
- uploaded documents
- extraction status
- document lifecycle
- live agent feed
- risk signals
- final decision card

### Why
The current design feels off because:
- the pool and form are competing in one area
- the right side is underused
- the layout does not clearly separate action from intelligence

---

## Step 2. Split the center section vertically

### Top section
The top 65–70% of the center should be the animated pool only.

### Bottom section
The bottom 30–35% should be the intake dock.

### Intake dock must include
- company fields
- beneficiary fields
- document upload
- consent checkbox
- main run button

### Why
This gives the swarm room to breathe and makes the pool feel like a real operational canvas rather than a background behind a form.

---

# Phase 2 — Improve the Pool Structure

## Step 3. Replace random node placement with a structured investigation map

Arrange evidence nodes intentionally.

### Suggested pool map
- Center = Company
- Upper left = Registration Date
- Upper right = Existence Check
- Left lower = Documents
- Lower center = Nature of Business
- Right center = Beneficiary
- Lower right = Bank / Account

### Rules
- nodes must not look scattered randomly
- each node should correspond to an actual review dimension
- keep enough spacing so tadpoles can travel between nodes visibly

### Why
The pool should behave like a fraud investigation map, not random floating objects.

---

## Step 4. Add subtle node connection lines

### Connect these relationships
- Company ↔ Registration Date
- Company ↔ Nature of Business
- Company ↔ Documents
- Company ↔ Beneficiary
- Beneficiary ↔ Bank / Account
- Documents ↔ Beneficiary
- Documents ↔ Company

### Visual treatment
- faint lines only
- curved lines preferred
- underwater / organic style
- should not overpower the pool

### Why
This gives the pool structural intelligence similar to Mirofish while keeping your aquatic identity.

---

## Step 5. Give nodes interaction states

Each node should support:
- idle
- active
- flagged
- resolved

### Visual state guidance
- idle = soft dim glow
- active = cyan pulse
- flagged = amber or red pulse
- resolved = green ring or soft stable glow

### Add
- hover tooltip
- mini summary
- click-to-focus behavior later

---

# Phase 3 — Add the Missing Document System

## Step 6. Add a proper Supporting Documents upload section

The bottom intake dock must include a dedicated upload card.

### Required upload UI
- drag and drop zone
- click to upload option
- accepted file types:
  - PDF
  - JPG
  - PNG
- document type selector:
  - Invoice
  - Agreement
  - Payment Voucher
  - Sales and Purchase Agreement
  - Tenancy Agreement
  - Other

### Required UI note
Display this privacy notice:

> Documents are processed temporarily for verification. Original files are deleted after extraction. Only a secure file fingerprint and structured verification data are retained.

### Why
This is operationally necessary and also increases user trust.

---

## Step 7. Build the document lifecycle visualization

When a document is uploaded:

### Required sequence
1. document appears in right panel as uploaded
2. document appears in the pool as a temporary evidence node
3. nearby tadpoles move toward it
4. right panel shows:
   - extracting
   - hashing
   - deleting original
5. after processing, the original document node disappears or transforms
6. the system retains only:
   - file hash
   - extracted fields
   - audit log
   - status

### Right panel statuses
- Uploaded
- Extracting
- Hash Generated
- Original Deleted
- Evidence Ready

### Why
This turns compliance into a visible product strength.

---

## Step 8. Implement backend storage rules for document handling

### Must do
- store uploaded file temporarily
- compute file hash using SHA-256
- extract structured fields
- delete the original file after processing
- store only:
  - file hash
  - extracted metadata
  - document type
  - timestamps
  - processing status

### Must not store
- raw document permanently
- full original scan after processing
- persistent user preview of original file after deletion

### Suggested DB fields
- case_id
- document_id
- file_name
- mime_type
- document_type
- file_hash
- extracted_json
- processing_status
- uploaded_at
- deleted_at

---

# Phase 4 — Upgrade Tadpole Motion

## Step 9. Stop treating tadpoles as decorative floating icons

Tadpoles must become behavior-driven agents.

Each tadpole should have:
- position
- target position
- velocity
- direction
- state
- tail phase
- current node assignment
- optional current chat bubble

### Why
Without behavior logic, the swarm feels fake.

---

## Step 10. Implement a tadpole state machine

Each tadpole must support these states:

- IDLE
- ASSIGNED
- MOVING
- INSPECTING
- REPORTING
- DEBATING
- CONSENSUS

### Meaning
- IDLE = slow free swim
- ASSIGNED = has a destination
- MOVING = traveling toward node or another tadpole
- INSPECTING = orbiting or hovering near a node
- REPORTING = showing a chat bubble
- DEBATING = moving near another tadpole to exchange views
- CONSENSUS = clustering centrally after agreement

### Why
This creates visible intelligence.

---

## Step 11. Implement smooth movement logic

### Technical requirement
Do not use abrupt position changes.

Use:
- velocity-based movement
- interpolation
- easing
- slow arrival near targets
- subtle idle wandering
- slight direction changes
- state-based speed differences

### State-specific motion
- idle = slow drift
- moving = intentional swim
- inspecting = slow orbit or hover
- debating = move to nearby tadpole
- consensus = gather in center

### Why
Smooth motion is what makes the tadpoles feel alive.

---

## Step 12. Add tail animation and body response

### Required motion details
- tail oscillates continuously
- idle tail = slow rhythm
- alert tail = faster rhythm
- suspicious or debate = sharper movement

### Add optional body effects
- slight rotation toward direction of travel
- small speed burst on alert
- pulsing glow when speaking

### Why
Small animation details create premium motion quality.

---

# Phase 5 — Add Swarm Conversation Visibility

## Step 13. Add chat popups above tadpoles

Each active tadpole should be able to display short messages.

### Message rules
- short only
- 2–6 words preferred
- fades in and out
- color-coded by sentiment
- tied visually to the tadpole

### Example messages
- Registration 2025
- Account mismatch
- Document looks valid
- Weak footprint
- Seen before
- Need stronger proof
- Escalate recommended

### Why
This makes the swarm reasoning visible.

---

## Step 14. Add a Live Agent Feed in the right panel

Create a scrolling panel that logs tadpole actions.

### Example feed entries
- [RA] Company registered in 2025
- [DA] Invoice fields consistent
- [HS] Beneficiary account linked to prior flagged case
- [SK] Challenge: current evidence may be insufficient
- [CH] Recommendation moved to manual review

### Requirements
- include agent code
- include time or sequence number
- newest entries on top or bottom consistently

### Why
Users need both cinematic swarm behavior and readable system logs.

---

# Phase 6 — Make the Right Panel Useful

## Step 15. Turn the right panel into the Intelligence Panel

### Required sections
1. Documents
2. Processing Lifecycle
3. Live Agent Feed
4. Risk Signals
5. Final Decision

### Section details

#### Documents
- file name
- type
- processing stage
- hash status

#### Processing Lifecycle
- uploaded
- extracted
- hashed
- deleted

#### Live Agent Feed
- tadpole log messages

#### Risk Signals
- high / medium / low severity items

#### Final Decision
- APPROVE
- REVIEW
- ESCALATE
- REJECT

### Why
This is the biggest gap between current prototype and a product-like system.

---

## Step 16. Add a Final Decision Card

The decision card should include:
- outcome
- confidence summary
- top triggered reasons
- recommended next action

### Example
- Outcome: Escalate
- Reason 1: Beneficiary account inconsistency
- Reason 2: Recent company registration
- Reason 3: Weak external business footprint
- Recommended action: Verify with relevant fraud validation team

### Why
The system must not only look smart; it must communicate clearly.

---

# Phase 7 — Add Better UX Structure

## Step 17. Add a top progress indicator

Add a visual process tracker.

### Suggested steps
- Intake
- Upload
- Extraction
- Swarm Review
- Challenge
- Decision

### Why
This helps users understand where they are in the flow.

---

## Step 18. Add a cleaner top bar

Include:
- case ID
- active stage
- overall status
- timestamp or session status

### Example
- Case: TP-2026-000021
- Stage: Swarm Review
- Status: Running

### Why
This makes the interface feel operational and real.

---

# Phase 8 — Improve Visual Appeal

## Step 19. Reduce visual clutter

### Required cleanup
- reduce unnecessary glow
- improve typography contrast
- keep node labels readable
- avoid over-stacking text directly on the canvas
- reduce random visual noise

### Why
Mirofish feels premium because it is clean even when complex.

---

## Step 20. Use hover and click layers instead of permanent text clutter

### On-canvas labels
Use short labels:
- Co
- Reg
- Docs
- Ben
- Bank
- NOB
- Exist

### On hover
Show full name and details.

### Why
This keeps the pool elegant.

---

## Step 21. Add subtle underwater depth effects

Use minimal environmental effects:
- slow drifting particles
- faint gradient movement
- very light bloom
- occasional soft ripple on major events

### Do not overdo
The environment should support the swarm, not distract from it.

---

# Phase 9 — Align the Experience with Fraud Investigation

## Step 22. Give each tadpole a defined role

Examples:
- NB = Nature of Business
- RA = Registration Age
- DA = Document Authenticity
- EV = Existence Verification
- BC = Beneficiary Consistency
- HS = Historical Suspicion
- SK = Skeptic
- PR = Prosecutor
- CH = Chair

### Requirements
- role label
- assigned node(s)
- typical movement pattern
- color/state response

### Why
The swarm should feel like a team of specialists.

---

## Step 23. Make tadpoles move to the section they are discussing

### Required behavior examples
- Registration Age tadpole moves toward Reg Date
- Document Authenticity tadpole moves toward Docs
- Beneficiary Consistency tadpole moves between Beneficiary and Bank / Account
- Skeptic tadpole moves near active discussing agents
- Chair tadpole stays central, gathers near consensus

### Why
This is essential to achieve your Mirofish-like capability in swarm form.

---

# Phase 10 — Make It Claude-Executable

## Step 24. Implement improvements in this order

### Build order
1. restructure layout into 3-column system
2. split center into Pool + Intake Dock
3. create right-side Intelligence Panel
4. add document upload UI
5. implement temporary file flow
6. add document lifecycle states
7. reposition nodes into investigation map
8. add node relationship lines
9. implement tadpole state machine
10. implement smooth movement engine
11. add chat popups
12. add live agent feed
13. add progress indicator
14. add final decision card
15. clean typography and spacing
16. refine hover and focus interactions

### Important
Do not try to perfect everything visually before the layout and behavior system are correct.

---

## Step 25. Use the correct rendering approach

### Recommendation
Use canvas-based rendering for the pool if possible.

Preferred options:
- HTML Canvas
- PixiJS if richer animation is needed

Avoid relying purely on static DOM elements for moving tadpoles if performance starts degrading.

### Why
Smooth swarm motion needs efficient rendering.

---

# Phase 11 — Final Product Standard

## Step 26. Define what “good enough” means

The redesign is successful when:

- the layout clearly separates control, interaction, and intelligence
- document upload is visible and trustworthy
- uploaded files are shown as temporary artifacts
- the system visibly hashes and deletes originals
- tadpoles move smoothly and with intent
- tadpoles visibly discuss evidence
- the right panel explains what is happening
- the final decision is clear and auditable
- the interface feels clean, not cluttered

---

# Final Instruction to Claude

Implement the redesign step by step.

Do not jump ahead.

Complete one major section at a time in this order:
1. layout
2. upload/document lifecycle
3. pool structure
4. movement engine
5. right panel intelligence
6. refinement

At every stage:
- preserve the Tadpools brand identity
- keep the Mirofish-inspired clarity
- maintain a clean premium design
- ensure the swarm remains the star of the product

---