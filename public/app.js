import { basicLogger, createClient } from "/vendor/launchdarkly-sdk.js";

const sampleContexts = [
  {
    label: "Anonymous visitor",
    shortLabel: "Anonymous",
    icon: "◎",
    context: {
      kind: "user",
      key: "anonymous-visitor",
      name: "Anonymous Visitor",
      email: "anon@example.com",
      plan: "free",
      segment: "general-audience",
      country: "IN",
    },
  },
  {
    label: "Individually targeted pilot account manager",
    shortLabel: "Pilot",
    icon: "✦",
    context: {
      kind: "user",
      key: "pilot-account-manager",
      name: "Priya Kapoor",
      email: "priya@abc.example",
      plan: "free",
      segment: "general-audience",
      country: "IN",
    },
  },
  {
    label: "Rule-based US design partner",
    shortLabel: "US Partner",
    icon: "◌",
    context: {
      kind: "user",
      key: "enterprise-designer",
      name: "Mason Lee",
      email: "mason@abc.example",
      plan: "enterprise",
      segment: "design-partners",
      country: "US",
    },
  },
];

const state = {
  client: null,
  config: null,
  currentContext: sampleContexts[0].context,
  flagValue: false,
  lastExposureSignature: "",
  experimentStats: {
    control: { exposures: 0, demoRequests: 0 },
    treatment: { exposures: 0, demoRequests: 0 },
  },
};

const connectionStatus = document.querySelector("#connection-status");
const flagKey = document.querySelector("#flag-key");
const flagState = document.querySelector("#flag-state");
const personaButtons = document.querySelector("#persona-buttons");
const personaInitials = document.querySelector("#persona-initials");
const personaTag = document.querySelector("#persona-tag");
const personaName = document.querySelector("#persona-name");
const personaSummary = document.querySelector("#persona-summary");
const personaChipOne = document.querySelector("#persona-chip-one");
const personaChipTwo = document.querySelector("#persona-chip-two");
const personaChipThree = document.querySelector("#persona-chip-three");
const experienceRoot = document.querySelector("#experience-root");
const eventLog = document.querySelector("#event-log");
const releaseButton = document.querySelector("#release-button");
const remediateButton = document.querySelector("#remediate-button");
const remediationMessage = document.querySelector("#remediation-message");
const curlSnippet = document.querySelector("#curl-snippet");
const secondaryCta = document.querySelector("#secondary-cta");
const experimentVisitorButton = document.querySelector("#experiment-visitor-button");
const demoRequestButton = document.querySelector("#demo-request-button");
const bulkExperimentButton = document.querySelector("#bulk-experiment-button");
const experimentHelper = document.querySelector("#experiment-helper");
const experimentStageWinner = document.querySelector("#experiment-stage-winner");
const stageControlTotal = document.querySelector("#stage-control-total");
const stageTreatmentTotal = document.querySelector("#stage-treatment-total");
const stageControlBar = document.querySelector("#stage-control-bar");
const stageTreatmentBar = document.querySelector("#stage-treatment-bar");
const stageControlExposures = document.querySelector("#stage-control-exposures");
const stageTreatmentExposures = document.querySelector("#stage-treatment-exposures");

boot();

async function boot() {
  renderPersonaButtons();
  renderPersonaStage(sampleContexts[0]);
  renderExperimentStats();

  state.config = await fetchJson("/api/config");
  flagKey.textContent = state.config.flagKey;
  curlSnippet.textContent = buildCurlSnippet(state.config);
  releaseButton.disabled = !state.config.canRemediate;
  remediateButton.disabled = !state.config.canRemediate;
  remediationMessage.textContent = state.config.canRemediate
    ? "The buttons are wired to the LaunchDarkly REST API through the local server."
    : "Optional: add LD_API_TOKEN, LD_PROJECT_KEY, and LD_ENV_KEY to enable the in-app release and kill switch.";

  if (!state.config.clientSideId) {
    connectionStatus.textContent = "Missing config";
    connectionStatus.className = "pill pill-off";
    logEvent("LaunchDarkly client-side ID is missing. Add LD_CLIENT_SIDE_ID to .env to connect the SDK.");
    renderDisconnectedExperience();
    return;
  }

  state.client = createClient(state.config.clientSideId, state.currentContext, {
    streaming: true,
    logger: basicLogger({ level: "warn" }),
  });

  state.client.on(`change:${state.config.flagKey}`, () => {
    syncVariation("Flag changed live through LaunchDarkly streaming.");
  });

  const initResult = await state.client.start({ timeout: 10 });

  if (initResult.status !== "complete") {
    connectionStatus.textContent = "Init issue";
    connectionStatus.className = "pill pill-off";
    logEvent(`SDK initialization did not complete cleanly: ${initResult.status}.`);
    renderDisconnectedExperience();
    return;
  }

  connectionStatus.textContent = "Connected";
  connectionStatus.className = "pill pill-on";
  logEvent("SDK initialized successfully. The page is now listening for live flag changes.");
  syncVariation("Initial variation loaded.");
}

async function selectPersona(index) {
  const selected = sampleContexts[index];
  renderPersonaButtons(index);
  await activateContext(selected, `Switching context to "${selected.label}" via identify().`);
}

secondaryCta.addEventListener("click", () => {
  syncVariation("Variation checked manually.");
});

experimentVisitorButton.addEventListener("click", async () => {
  const visitor = buildExperimentVisitor();
  renderPersonaButtons(-1);
  await activateContext(visitor, `Generated fresh experiment visitor "${visitor.context.key}".`);
});

bulkExperimentButton.addEventListener("click", async () => {
  if (!state.client) {
    return;
  }

  await generateBulkExperimentTraffic(100);
});

demoRequestButton.addEventListener("click", async () => {
  if (!state.client) {
    return;
  }

  await trackExperimentEvent(
    "hero-demo-requested",
    "demoRequests",
    "Tracked a demo request event for experimentation/metrics follow-up.",
  );
});

async function activateContext(entry, logMessage) {
  state.currentContext = entry.context;
  animatePersonaStage(entry);

  if (!state.client) {
    renderDisconnectedExperience();
    return;
  }

  logEvent(logMessage);
  const result = await state.client.identify(state.currentContext);

  if (result.status !== "success") {
    logEvent(`identify() did not complete successfully: ${result.status}.`);
  }

  syncVariation(`Re-evaluated flag for "${entry.label}".`);
}

releaseButton.addEventListener("click", () => {
  updateFlagState("on", "Turning the flag on...", "Release endpoint called successfully. The flag should turn on almost immediately.");
});

remediateButton.addEventListener("click", () => {
  updateFlagState("off", "Turning the flag off...", "Remediation endpoint called successfully. The flag should turn off almost immediately.");
});

function renderPersonaButtons(activeIndex = 0) {
  personaButtons.innerHTML = sampleContexts
    .map((entry, index) => {
      const isActive = index === activeIndex;
      return `
        <button
          class="persona-button ${isActive ? "persona-button-active" : ""}"
          type="button"
          data-persona-index="${index}"
        >
          <span class="persona-button-icon" aria-hidden="true">${entry.icon}</span>
          <span class="persona-button-title">${entry.label}</span>
          <span class="persona-button-subtitle">${personaButtonSubtitle(entry.context)}</span>
        </button>
      `;
    })
    .join("");

  for (const button of personaButtons.querySelectorAll("[data-persona-index]")) {
    button.addEventListener("click", () => {
      selectPersona(Number(button.dataset.personaIndex));
    });
  }
}

function renderPersonaStage(entry) {
  const { label, context } = entry;
  personaInitials.textContent = context.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  personaTag.textContent = label;
  personaName.textContent = context.name;
  personaSummary.textContent = personaSummaryText(context);
  personaChipOne.textContent = `Audience: ${personaAudienceText(context)}`;
  personaChipTwo.textContent = `Country: ${context.country}`;
  personaChipThree.textContent = `State: ${personaOutcomeText(context)}`;
}

function syncVariation(reason) {
  if (!state.client) {
    return;
  }

  state.flagValue = state.client.variation(state.config.flagKey, false);
  state.client.track("hero-variation-viewed", {
    flagEnabled: state.flagValue,
    contextKey: state.currentContext.key,
    country: state.currentContext.country,
  });
  registerExposure();
  flagState.textContent = state.flagValue ? "Revamped experience" : "Baseline experience";
  flagState.className = `pill ${state.flagValue ? "pill-on" : "pill-off"}`;
  renderExperience();
  logEvent(`${reason} LaunchDarkly returned ${state.flagValue}.`);
}

function renderExperience() {
  const experienceMarkup = state.flagValue
    ? `
      <article class="experience-card new">
        <div class="experience-body">
          <div class="experience-backdrop new-backdrop" aria-hidden="true">
            <span class="glow glow-one"></span>
            <span class="glow glow-two"></span>
            <span class="glow glow-three"></span>
            <span class="grid-line line-a"></span>
            <span class="grid-line line-b"></span>
          </div>
          <div class="experience-layout">
            <div class="experience-copy">
              <span class="badge">New experience enabled</span>
              <h3>AI-guided product tour</h3>
              <p>Visual, guided, adaptive.</p>
            </div>
            <div class="visual-stage visual-stage-new" aria-hidden="true">
              <div class="pulse-orbit orbit-one"></div>
              <div class="pulse-orbit orbit-two"></div>
              <div class="pulse-orbit orbit-three"></div>
              <div class="signal-core">
                <span class="signal-dot dot-a"></span>
                <span class="signal-dot dot-b"></span>
                <span class="signal-dot dot-c"></span>
              </div>
              <div class="metric-stack">
                <div class="metric-chip chip-rise">Adoption +18%</div>
                <div class="metric-chip chip-fast">Live rollout</div>
                <div class="metric-chip chip-safe">Instant rollback</div>
              </div>
            </div>
          </div>
          <div class="graphic-grid graphic-grid-new">
            <div class="graphic-tile tile-insight">
              <span class="graphic-kicker">Adaptive</span>
              <div class="mini-bars">
                <span style="height: 26%"></span>
                <span style="height: 48%"></span>
                <span style="height: 72%"></span>
                <span style="height: 96%"></span>
              </div>
            </div>
            <div class="graphic-tile tile-flow">
              <span class="graphic-kicker">Guided path</span>
              <div class="mini-path">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div class="graphic-tile tile-shield">
              <span class="graphic-kicker">Safe rollout</span>
              <div class="mini-shield"></div>
            </div>
          </div>
        </div>
      </article>
    `
    : `
    <article class="experience-card old">
      <div class="experience-body">
        <div class="experience-backdrop old-backdrop" aria-hidden="true">
          <span class="wireframe frame-a"></span>
          <span class="wireframe frame-b"></span>
          <span class="wireframe frame-c"></span>
        </div>
        <div class="experience-layout">
          <div class="experience-copy">
            <span class="badge">Baseline experience</span>
            <h3>Classic landing page component</h3>
            <p>Stable, familiar, rollback-safe.</p>
          </div>
          <div class="visual-stage visual-stage-old" aria-hidden="true">
            <div class="legacy-frame">
              <div class="legacy-topbar"></div>
              <div class="legacy-row row-wide"></div>
              <div class="legacy-row row-mid"></span>