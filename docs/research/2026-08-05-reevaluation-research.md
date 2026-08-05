# WariMCP Reevaluation — Research Appendix (2026-08-05)

Raw material from the wide-net reevaluation session (brainstorm, pre-decision).
Three substantive research reports + four adversarial fact-checks, produced by
web-research agents 2026-08-05. Feed for the eventual design doc / Decision
Journal entry. Nothing here is a ratified decision.

---

## A. Verified market facts (sourced, ~August 2026)

### Agentic-payments landscape
- **White space confirmed:** no funded startup builds MCP/agent-native payment
  rails for WAEMU/CFA francophone Africa. WariMCP is the only documented
  attempt. Adjacent OSS covers the anglophone flank only:
  `africa-payments-mcp` (M-Pesa/Paystack/MTN MoMo, MIT, updated Apr 2026),
  `DarajaMCP` (Kenya-only, not production-ready).
- **Visa:** $1B Africa commitment, explicit focus on 17 francophone countries;
  Djamo (CIV) partnership; Orange Money × Visa deal Dec 2025; names agentic
  commerce as next era, nothing shipped in WAEMU.
  (techcabal.com 2025-07-07, intelligentcio.com 2025-12-19)
- **Mastercard Agent Pay:** launched Apr 2025 w/ Stripe, Google, Antom;
  Africa acceptance +45% in 2025; first non-US txn UAE Nov 2025; no Africa
  pilot yet.
- **x402 (Coinbase):** 100M+ cumulative transactions by Q1 2026; x402
  Foundation board incl. Google, AWS, Visa, Circle, Cloudflare, **Anthropic**;
  v2 shipped late 2025. USDC-based — needs a bridge layer for CFA/mobile money.
- **Incumbent MCP servers:** Stripe (Feb 2025, mcp.stripe.com), Worldpay
  (Nov 2025), Coinbase Payments (Sep 2025), Grasshopper Bank (Aug 2025).
  None WAEMU-relevant.
- **MCP-infra funding wave:** Runlayer $11M (Khosla/Felicis, Nov 2025),
  Manufact $6.3M (Peak XV/YC, Feb 2026), Alpic €5M (Paris, Sep 2025),
  Skyfire $8.5M seed. Nevermined: 1.38M+ MCP-paywall transactions since
  May 2025, no round found.
- **Google's Africa AI program (2025):** zero francophone West African
  countries. Gap publicly recognized (TechNext editorial, June 2026), unsolved.

### BCEAO PI-SPI (interop rail) — corroborated by two independent reports
- Launched 2025-09-30. 80 institutions connected (June 2026); 30M connected
  users; 110B XOF (~$190M) transacted by July 2026. Full-participation
  deadline **2026-09-30**. Open-loop, 24/7, irrevocable. **No AI/agent layer.**
- Strategic implication: single-API-above-many-PSPs (WariMCP's original
  premise) erodes as PI-SPI matures. Durable layers: agent interface ABOVE,
  test tooling BESIDE, regional expertise AROUND.
- (ecofinagency.com, financialafrik.com, adfi.org, theafricareport.com)

### Humanitarian cash-transfer stack (kill-test result for the CVA idea)
- Middleware slot **already occupied**: PawaPay = dominant humanitarian
  payout aggregator for WAEMU (GiveDirectly-confirmed; CIV: MTN/Orange/Wave;
  SEN: Orange/Wave/Free; BFA: Orange/Moov; BEN: MTN/Moov). Also
  Onafriq/MFS Africa, Crown Agents Bank/Segovia, Tola Mobile.
- WFP (SCOPE) and UNHCR (CashAssist/PRIMES) run proprietary beneficiary
  systems and procure FSPs via global tenders (WFP LTA HQ23NF162), not by
  buying tools from small vendors. GSMA Mobile Money API v1.2 (2024) is the
  interop standard WFP pushes.
- Verdict: "WariMCP as CVA disbursement middleware" = LOW. Occupied lane.

### PSP payout API ground truth (useful for any payout work)
- **Wave:** public REST payout API. `POST /v1/payout`, `/v1/payout-batch`,
  `/v1/verify_recipient`. Bearer + optional HMAC. Idempotency (UUIDv4)
  required. IP whitelist per key. Fee 1% capped 5,000 XOF. Country-isolated
  keys (SEN ≠ CIV legal entities). Sandbox + magic test numbers.
  docs.wave.com/payout
- **MTN MoMo:** public Disbursement (bulk) product. momodeveloper.mtn.com.
- **Orange Money:** NO public bulk-disbursement API — webpay/merchant only;
  bulk = aggregator or bilateral per-country agreement.
- **Moov Money:** no public developer docs at all (aggregators abstract it).

### WhatsApp-commerce demand (verified core only)
- **Caribou "WhatsApp and Women's Livelihoods"** (pub. May 2026; Ipsos
  survey June 2025, 7,000 adults; Gates + Mastercard Foundation funded):
  ~89M women (range 80–98M) across Kenya, Nigeria, India, Pakistan use
  WhatsApp for income-generating activity (~1 in 6 working-age women).
  ⚠️ No francophone country in sample — CIV application is extrapolation.
  caribou.global/publications/whatsapp-and-womens-livelihoods/
- **Standard Bank/Foshizi 2025:** 74% of SMEs use WhatsApp to reach
  customers — SOUTH AFRICA TOWNSHIPS ONLY (250+ interviews). Not
  generalizable.
- **Kantar Africascope 2020/2021** (real study, ~15-17k respondents, 8
  francophone capitals): WhatsApp accounts 68% vs Facebook 64% (CIV: 71% vs
  68%). CONFIRMED usable — cite as Kantar alone (not "Kantar/Havas") and as
  ACCOUNT PENETRATION in urban capitals, not "daily active use".

### WAEMU payments-infrastructure deep-dive (multi-source verified)
- **Instruction 001-01-2024 compliance shock:** only **11 firms licensed
  across all WAEMU** as of May 2025 (CIV: SYCA, TouchPoint, Firstcom,
  Julaya; SEN: PayDunya, Mikaty, Bictorys, Flutterwave; BFA/MLI: InTouch;
  NER: i-Futur). FedaPay, Wave, Orange Money were on the temporary
  suspension list before later licensing (FedaPay licensed Apr 2026 per
  ROADMAP). **Compliance is the moat and the barrier** — most fintechs were
  unlicensed under the new regime. (doublefeather.com)
- **Hub2:** €8M Series A Aug 2024 (TLcom lead, FMO, Bpifrance); €70M (2022)
  → ~€1B (2024) projected volume; claims 98%+ success rate vs ~50% market
  average; Ecobank partnership = 200M wallets/32 markets. Most-funded
  WAEMU B2B payment-API pure-play.
- **Bizao post-mortem (adversarial data point):** €8M-funded, 300M payment
  requests/month, liquidated by French court 2025. Cause: thin margins on
  cross-border infra + telco integration costs + regulatory complexity.
  Direct warning on WAEMU B2B payment-infra unit economics.
- **USSD = 89% of mobile-money interactions in WAEMU** (BCEAO via GSMA) —
  validates the USSD-channel thesis in docs/ussd-civ-discovery-brief.md.
- **71.7% of WAEMU clearing value still flows through paper cheques** (2025,
  single source citing BCEAO annual report — MEDIUM confidence). Largest
  undigitized B2B corridor.
- Funding context: Wave €117M debt (2025) + IFC €90M equity; Moniepoint
  $200M Series C; Partech 2025: Africa $4.1B total, fintech $769M of equity.

### WhatsApp chatbot/BSP landscape — WAEMU competitive gap (HIGH confidence)
- **No platform-level "WhatsApp + WAEMU mobile money" product exists.**
  Global BSPs covering WAEMU (HelloDuty $199/mo, WATI, ChakraHQ) are
  English-first, USD-priced, no Wave/OM/MoMo rails. Francophone SaaS
  (Whakup, €30-450/mo) has no mobile money. Only a solo Beninois freelancer
  (Paul Maxime Dossou, Cotonou) does custom chatbot+MoMo builds
  (150k FCFA setup + 15-80k/mo).
- Local agency price floor: Pixl Studio Abidjan 30-80k FCFA/mo tiers;
  Clasoft Abidjan (Nouchi-capable, agency model).
- Bayobab (MTN) is a telecom BSP with no visible merchant product — and
  notably no MoMo integration despite owning MoMo.
- **No PSP (PayDunya/FedaPay/CinetPay) offers native in-chat WhatsApp
  payment flows either** — all three only have shareable payment links.
  The WhatsApp+payment slot is unowned at BOTH the platform and PSP level.

### PSP comparison — PayDunya / FedaPay / CinetPay (2026-08-05 sweep)
- ⚠️ **CinetPay: September 2025 cyberattack — $1.2M+ (655M+ XOF) owed to
  merchants, UNRESOLVED as of Feb 2026** (TechCabal 2026-02-01 + WeeTracker,
  multi-source; CEO acknowledged Oct 2025; partner DPay covering settlements
  from own capital). Research agent's judgment: hard disqualifier for new
  merchant integrations until publicly resolved. **POLICY-RELEVANT: the LTS
  market rule says "Use CinetPay/Wave, never Stripe" (lts-playbook §PROD-1)
  — needs owner review + verification before any client integration.**
- **PayDunya:** acquired by Peach Payments (SA) Apr 2025 (direction risk);
  strongest CIV+SEN combo incl. Wave both countries; MM fees 1.5-2.2%;
  no Shopify plugin.
- **FedaPay** (WariMCP's live rail): Benin-first (1.8% MoMo Benin, no
  monthly fee, published pricing); CIV reach partial (MTN CI in API; Wave
  NOT confirmed); 80k merchants / 450k tx/mo — smallest of the three.
- All fee/coverage details and sources in the agent report (session
  transcript, task a5e97c91d71884421).
- **The unowned slot:** self-serve WhatsApp-commerce SaaS in French, priced
  in XOF, with CinetPay/Wave/Orange Money built in, Nouchi/Wolof-tolerant
  NLP, aimed at informal/semi-formal merchants. Payment-aggregator fee
  benchmarks: CinetPay 1.5-2%, PayDunya 1.5-2.2%, Hub2 1.8-2.5%.
- **CORRECTION from second sweep (2026-08-05): slot unowned but edges are
  crowding.** Named players one move away:
  - **Yelen** (Abidjan, June 2025, ex-Google founder): "Shopify for social
    sellers" — storefronts for WhatsApp/IG sellers, 5,500 merchants, ~$60K
    volume, raising $300K pre-seed; mobile money via PowerPay; NO chatbot,
    NO CinetPay/Wave-CI integration. **Live partnership window while
    pre-institutional** — they need exactly the multi-provider payment
    layer WariMCP is. (techpoint.africa, socialnetlink.org)
  - **Sira** (Dakar): WhatsApp AI automation for SMEs, 1M+ msgs, beta — NO
    payments.
  - **Payaza Chat & Pay** (Nigeria): WhatsApp-native checkout, LICENSED in
    CIV + Benin, but NGN rails, no XOF mobile-money documented.
  - **Vendy** (YC): pivoted to "Agentic Payments Infrastructure" — Unified
    Payment Agent for AI chatbots (Stripe/Meta partners). Nigeria-first.
    Direct structural relevance to the agentic-bridge idea (#1) — watch.
  - **LAfricaMobile** (Dakar, €4.3M Series A 2024, Bpifrance): WhatsApp BSP
    + Bill Payment API, 60+ operators, francophone focus — infrastructure/
    distribution partner candidate.
- **Meta WhatsApp API rule change (Jan 2026): general-purpose chatbots
  banned** — only scoped business bots (orders, support, bookings)
  permitted. Favors purpose-built merchant tools; constrains any generic
  LLM-wrapper approach.
- **Meta launched native AI agents for WhatsApp Business GLOBALLY (June
  2026, TechCrunch; token-priced).** Meta now sells the conversation layer
  itself. Combined with the Jan 2026 ban: the chatbot layer is
  commoditizing fast — the durable open layer in WAEMU WhatsApp commerce
  is the PAYMENT/orchestration side (which Meta does not have for XOF
  mobile money). Confirms the "supply the payment layer" variant as the
  right form of this opportunity, not a chatbot SaaS.
- More edge-crowders found (third sweep): **Chariow** (no-code shop,
  native Orange/MTN/Moov/Wave + WhatsApp via Green API, **15% commission
  per sale** — a willingness-to-pay anchor); **Jangaan Tech** (Dakar,
  chatbot builds WITH Wave/Orange integration — agency level);
  **UPWAW** (WhatsApp API platform explicitly covering SEN/CI/MLI/BFA,
  mobile-money-in-WhatsApp positioning — partner candidate);
  **ChatCash** (Zimbabwe, closest functional blueprint: in-chat commerce +
  payments + white-label API, ~$125/mo/business, EcoCash rails, not in
  WAEMU); **MTN "Eva de MoMo"** (consumer MoMo chatbot since 2019, NO
  merchant API).
- **Integration-burden anchors (the pain WariMCP abstracts, verified):**
  MTN MoMo API integration = 400,000-900,000 FCFA + 1-3 week KYC;
  switching aggregators = 5-8 days dev work; Wave Business activation
  5-10 days, country-specific keys. Wave virtual Visa card launched
  Jan 2026 (Senegal, w/ Visa + Ecobank) — consumer-side fix only.
- Verified informality base: **97% of Senegalese businesses informal**
  (ANSD/WIEGO Statistical Brief N°31).

### Merchant pain ground truth (fourth sweep — best evidence in the tree)
- **ANCHOR DEMAND STAT (HIGH, citable): 75% of online transactions in
  Côte d'Ivoire occur via social-media sellers** (WhatsApp/IG/FB), not
  e-shop websites — U.S. Trade.gov Country Commercial Guide.
- **The #1 daily pain is RECONCILIATION, not collection** (HIGH,
  cross-confirmed): dominant checkout = "send to my Wave number and
  screenshot me" → manual screenshot verification (fraud-prone, fake
  screenshots common); end-of-day reconciliation ≈ **2 hours manual**;
  merchants cannot query their own Wave history programmatically (gated
  API). Mixed cash+MoMo sales have no tooling. → Direct upgrade for the
  Odoo/reconciliation idea (#5). ⚠️ Competitor signal: **yorine.app**
  (Senegal POS/reconciliation) operates here — check before building.
- **MicroSave Abidjan field study (2019): 95% of informal merchants had
  ZERO formal merchant payment acceptance** — KYC/KYB wall (RCCM, tax ID,
  RIB, address proof). 610k informal production units in Abidjan commerce.
- **Provider quirk inventory (HIGH, primary docs/forums) — this is the
  sandbox-simulator (#6) feature spec:**
  - Wave: 30-min non-extensible checkout session; NO webhook docs at all;
    signing key shown once; clock-skew rejection (>5min past/>30s future);
    IP whitelist irreversible self-serve; no recurring payments; same-
    country-only; country-siloed keys.
  - MTN MoMo: HTTP 202 ≠ success (poll for status; silent failures);
    OAuth tokens hard-expire 1h with NO refresh token; sandbox publicly
    unreliable; undocumented rate limits (surprise 429s); duplicate
    webhooks (dedup required); prod credentials 2-8 weeks.
  - Orange Money: USSD OTP exit-page checkout (customer leaves page, dials
    USSD, returns with OTP); no public sandbox; per-country vetting;
    physical-store onboarding.
  - CinetPay: notify_url webhooks silently not delivered (unresolved forum
    thread); Wave not activated by default; J+1..J+3 settlement.
- **Why Stripe is absent (verified):** BCEAO Notice 004-03-2025 = 100M XOF
  capital + local entity PER COUNTRY; 79 PI applications → only ~30
  approved (38%). May 2025 enforcement caused outages (Wave partial,
  Banxaas total, frozen wallets, blocked payroll). CI formal e-commerce
  ≈ $80M (Trade.gov) — too small to justify 8 licenses for Stripe.
- WAEMU mobile money = **63.5% of GDP (2021)**, up from 5.9% (2014)
  [MEDIUM — BCEAO PDF not machine-verified].
- Additional refuted stat for section B: **"88% of African B2C via mobile
  money" — REFUTED**, appears in no credible primary source.
- **New option variant surfaced by this data — "supply the payment layer
  to the social-commerce race":** instead of building the merchant SaaS
  solo, sell/integrate WariMCP's multi-provider orchestration into
  Yelen/Sira/Payaza-class players who have merchants but lack XOF payment
  depth. B2B, fits existing codebase, no consumer go-to-market. Cheapest
  test: one intro conversation with Yelen while they're pre-seed.

---

## B. DO-NOT-CITE list (adversarially refuted claims)

| Claim | Verdict | Why |
|---|---|---|
| "78% of SSA small businesses sell through WhatsApp" | REFUTE | Citation-laundered from a chatbot vendor's marketing page (Arkesel via AVODA); likely confabulation of two unrelated IFC stats (90% informal, 78% of employment). No primary source. |
| "80%+ of SSA adults message a business weekly (Meta 2024)" | REFUTE | Meta's actual Kantar surveys (2024: 13 markets; 2025: 22 markets) include ZERO SSA countries. Likely mutation of "80% smartphone WhatsApp install rate". Only home: mynewsgh.com aggregator piece. |
| "Africa social commerce = $33.7B in 2026" | REFUTE (HIGH) | Single vendor (PayNXT360 databook, paid GlobeNewswire release, $2,900 report). Internal contradictions: SA sub-report $1.54B (2025) → $10.51B (2026) = 582% jump vs claimed 14.1% growth; NGA+SA = 68% of "Africa" total; subset would be 70-85% of Africa's ENTIRE e-commerce (~$40-50B). Zero institutional corroboration. |
| "90M women use WhatsApp for income — TechTrendsKE" | WEAK citation / CONFIRMED fact | Number is real (Caribou 89M, above) but must be cited to Caribou/Ipsos, not the blog. |
| "40% of Senegal online purchases via social networks" | WEAK→REFUTE | Not even present on the systalink.com page it's attributed to; no primary source anywhere; Senegal has NO official e-commerce transaction data (UNCTAD). Likely mutation of seller-side "77% of Anka merchants" figure. |
| "WhatsApp 68% vs Facebook 64% francophone SSA (Africascope)" | ✅ USABLE with fixes | Real Kantar study, figures verbatim. Cite as Kantar alone (no Havas), account penetration (not daily use), 8 urban capitals only. |

Rule confirmed by this exercise: every round marketing number in this space
failed checking; the numbers that survive are boring institutional ones
(PI-SPI 110B XOF, Caribou 89M, x402 100M tx). Primary demand checks (talking
to actual merchants) > quoted statistics.

---

## C. Where the reevaluation stands (as of this file's writing)

Fresh net (beyond the 8 already-known options), post-evidence ratings:
1. **AP2/ACP/agentic WAEMU bridge — the agent layer PI-SPI lacks**: strongest
   strategic play, verified empty seat, incumbents circling CIV. MED-HIGH.
2. WhatsApp conversational checkout: **MED-HIGH after late research** —
   competitive gap verified HIGH confidence (no platform or PSP owns
   WhatsApp+WAEMU-mobile-money, French/XOF, informal-merchant slot); demand
   still needs PRIMARY validation (Abidjan merchants), stats layer is mostly
   citation-laundered (see B); Meta-verification blocker stands.
3. Humanitarian CVA toolkit: **LOW** (kill-tested by research — occupied lane).
4. Payout-first pivot: folded into #1 (raw payout aggregation = PawaPay's
   lane; only the agent-native form is differentiated).
5. Odoo/SYSCOHADA mobile-money reconciliation connector: HIGH solo-fit,
   kill-test = search Odoo app store (10 min).
6. **WAEMU sandbox simulator ("LocalStack for mobile money")**: HIGH solo-fit,
   zero regulatory surface, kill-test = FR dev.to post + gist, 2 weeks.
7. License stack to funded fintech (Djamo etc.): kill-test = 3 emails.
8. Standards/community seat (x402 Foundation, AP2 GitHub, FR guide): cheap,
   do regardless; Anthropic on x402 board is relevant to the pending
   Anthropic Partner Network application.

Standing recommendation (not ratified): barbell — run kill-tests #5/#6/#7;
publish the ~90%-built MIT calling card while "first MCP server for WAEMU
mobile money" is still true (board review gates the outward steps); take #8;
design the build phase around #1 framed as "the agent interface to WAEMU
payments / PI-SPI" rather than "10 provider adapters".

## D. Consolidated survivor list (end of session, for owner pick)

Prerequisite for ANY repo work: reconcile local main with origin/main +
decide the MIT-vs-FSL license fork (~1 session, mechanical).

| # | Idea | Evidence | Solo-fit | First step / kill-test | Build size |
|---|---|---|---|---|---|
| 1 | Publish MIT calling card (I4: npm+registry+dev.to) | HIGH (built; claim perishable) | HIGH | board review → publish chain | hours |
| 2 | WAEMU sandbox simulator (LocalStack for mobile money) | HIGH (quirk spec verified; no competitor found) | HIGH | FR gist+dev.to post, 2-wk signal | 2-4 wk MVP |
| 3 | Odoo/SYSCOHADA reconciliation connector | HIGH pain (2h/day) — competitor check pending | HIGH | Odoo-store search + yorine.app check (10 min) | 2-3 wk MVP |
| 4 | Agentic bridge (AP2/ACP/x402 → WAEMU rails; agent layer for PI-SPI) | MED-HIGH (white space verified; timing uncertain) | MED | 1-wk AP2-mandate spike over FedaPay adapter | weeks+ |
| 5 | Payment layer for social-commerce players (Yelen/LAfricaMobile/UPWAW) | MED-HIGH (gap verified; Meta commoditizes chat layer) | MED (partner-dependent) | 1 intro conversation w/ Yelen | per deal |
| 6 | Hub2 reference integration (port lagoon-website shapes) | MED-HIGH (Hub2 momentum; Laurraine channel) | HIGH (proven code) | port + sandbox smoke | ~1 session |
| 7 | Standards/community seat (x402 Fdn, AP2 GitHub, FR guide) | MED (option value) | HIGH | first GitHub contribution | 2h/wk ongoing |
| 8 | License/sell stack to funded fintech | LOW-MED | test-only | 3 emails | n/a |
| 9 | Internal rail: Moi by DNC → FedaPay (Tier D) | MED (live keys verified; spa pay-flow unknown) | HIGH | FedaPay probe + check spa flow | days |
| 10 | x402 pay-per-call productization (existing branch) | LOW-MED locally (Kronos $0) | MED | PARK until external demand signal | blocked by license fork |

KILLED this session: humanitarian CVA toolkit (occupied lane), standalone
payout aggregation (PawaPay's lane), chatbot-SaaS form of the WhatsApp play
(Meta native agents), USSD substrate (own gate, DÔGÔ decision, not WariMCP).

Synergy: 1+2+6 compose into one coherent repo story ("the server + the test
harness + a second live provider"). 4 builds on 6's adapter. 10 conflicts
with 1 until the license decision.

Repo state notes (verified this session): origin/main has the manual-payments
hard-removal (PR #1, 2026-06-12); LOCAL main diverged (kaizen committed to
stale main) — reconcile before any work; i4 registry artifacts built,
publish steps gated; x402-billing branch carries an unresolved MIT→FSL
license fork; FedaPay LIVE-mode keys present in .env; npm name `warimcp`
owned (v0.0.1, 2026-03-01); GitHub 0 stars/forks, 34 npm downloads/mo
(mirror noise).
