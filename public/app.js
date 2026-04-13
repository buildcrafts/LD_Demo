import { basicLogger, createClient } from "/vendor/launchdarkly-sdk.js";

// These sample contexts are meant to line up with the targeting instructions in the README.
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

  // This listener is what makes LaunchDarkly flag changes appear live in the UI.
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

  // The LaunchDarkly flag key defaults to "revamped-hero" unless LD_FLAG_KEY is changed in .env.
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
              <div class="legacy-row row-mid"></div>
              <div class="legacy-columns">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
        <div class="graphic-grid graphic-grid-old">
          <div class="graphic-tile tile-static">
            <span class="graphic-kicker">Static</span>
            <div class="legacy-bars">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div class="graphic-tile tile-safe">
            <span class="graphic-kicker">Known-good</span>
            <div class="legacy-stack">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div class="graphic-tile tile-rollback">
            <span class="graphic-kicker">Rollback</span>
            <div class="rollback-loop"></div>
          </div>
        </div>
      </div>
    </article>
  `;

  animateExperienceSwap(experienceMarkup);
}

function renderDisconnectedExperience() {
  experienceRoot.innerHTML = `
    <article class="experience-card old">
      <div class="experience-body">
        <span class="badge">Setup required</span>
        <h3>Add LaunchDarkly credentials</h3>
        <p>
          The app is built and ready, but it needs <code>LD_CLIENT_SIDE_ID</code> in
          <code>.env</code> before the browser SDK can connect and evaluate your feature flag.
        </p>
      </div>
    </article>
  `;
}

function logEvent(message) {
  const timestamp = new Date().toLocaleTimeString();
  const item = document.createElement("li");
  item.textContent = `[${timestamp}] ${message}`;
  eventLog.prepend(item);
}

function animatePersonaStage(entry) {
  const stage = document.querySelector(".persona-stage");
  stage.classList.add("persona-stage-switching");
  window.setTimeout(() => {
    renderPersonaStage(entry);
    stage.classList.remove("persona-stage-switching");
    stage.classList.add("persona-stage-enter");
    window.setTimeout(() => stage.classList.remove("persona-stage-enter"), 420);
  }, 150);
}

function animateExperienceSwap(markup) {
  experienceRoot.classList.add("experience-root-switching");
  window.setTimeout(() => {
    experienceRoot.innerHTML = markup;
    experienceRoot.classList.remove("experience-root-switching");
    experienceRoot.classList.add("experience-root-enter");
    window.setTimeout(() => experienceRoot.classList.remove("experience-root-enter"), 460);
  }, 170);
}

async function updateFlagState(action, pendingMessage, successMessage) {
  remediationMessage.textContent = pendingMessage;

  try {
    const response = await fetch("/api/remediate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.detail || payload.error || "Flag update failed");
    }

    remediationMessage.textContent = payload.message;
    logEvent(successMessage);
  } catch (error) {
    remediationMessage.textContent = error.message;
    logEvent(`Flag update failed: ${error.message}`);
  }
}

async function trackExperimentEvent(eventKey, metricType, successMessage) {
  // LaunchDarkly experiment metrics are created against these tracked event keys.
  state.client.track(eventKey, {
    flagEnabled: state.flagValue,
    contextKey: state.currentContext.key,
    country: state.currentContext.country,
    email: state.currentContext.email,
  });
  incrementMetric(metricType);
  await state.client.flush();
  renderExperimentStats();
  logEvent(successMessage);
}

async function generateBulkExperimentTraffic(count) {
  experimentVisitorButton.disabled = true;
  demoRequestButton.disabled = true;
  bulkExperimentButton.disabled = true;
  experimentHelper.textContent = `Generating ${count} fresh experiment visitors and demo requests...`;

  let controlCount = 0;
  let treatmentCount = 0;
  let lastVisitor = null;

  try {
    for (let index = 0; index < count; index += 1) {
      const visitor = buildExperimentVisitor();
      lastVisitor = visitor;
      const result = await state.client.identify(visitor.context);

      if (result.status !== "success") {
        continue;
      }

      await delay(80);

      const flagValue = state.client.variation(state.config.flagKey, false);
      const cohort = flagValue ? "treatment" : "control";

      state.experimentStats[cohort].exposures += 1;
      state.experimentStats[cohort].demoRequests += 1;
      state.client.track("hero-variation-viewed", {
        flagEnabled: flagValue,
        contextKey: visitor.context.key,
        country: visitor.context.country,
      });
      state.client.track("hero-demo-requested", {
        flagEnabled: flagValue,
        contextKey: visitor.context.key,
        country: visitor.context.country,
        email: visitor.context.email,
      });

      if (cohort === "treatment") {
        treatmentCount += 1;
      } else {
        controlCount += 1;
      }

      if ((index + 1) % 10 === 0) {
        renderExperimentStats();
        experimentHelper.textContent = `Generated ${index + 1}/${count} experiment visitors...`;
        await state.client.flush();
      }
    }

    if (lastVisitor) {
      state.currentContext = lastVisitor.context;
      state.flagValue = state.client.variation(state.config.flagKey, false);
      renderPersonaButtons(-1);
      renderPersonaStage(lastVisitor);
      renderExperience();
    }

    renderExperimentStats();
    await state.client.flush();
    experimentHelper.textContent = `Generated ${count} visitors: ${controlCount} control, ${treatmentCount} treatment. Refresh LaunchDarkly results in 1-2 minutes.`;
    logEvent(`Bulk experiment traffic generated for ${count} fresh users.`);
  } catch (error) {
    experimentHelper.textContent = `Bulk traffic failed: ${error.message}`;
    logEvent(`Bulk experiment traffic failed: ${error.message}`);
  } finally {
    experimentVisitorButton.disabled = false;
    demoRequestButton.disabled = false;
    bulkExperimentButton.disabled = false;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function registerExposure() {
  const cohort = state.flagValue ? "treatment" : "control";
  const signature = `${state.currentContext.key}:${cohort}`;

  if (signature === state.lastExposureSignature) {
    return;
  }

  state.lastExposureSignature = signature;
  state.experimentStats[cohort].exposures += 1;
  renderExperimentStats();
}

function incrementMetric(metricType) {
  const cohort = state.flagValue ? "treatment" : "control";
  state.experimentStats[cohort][metricType] += 1;
}

function renderExperimentStats() {
  const control = state.experimentStats.control;
  const treatment = state.experimentStats.treatment;
  const totalConversions = control.demoRequests + treatment.demoRequests;
  const controlBarWidth = totalConversions ? (control.demoRequests / totalConversions) * 100 : 0;
  const treatmentBarWidth = totalConversions ? (treatment.demoRequests / totalConversions) * 100 : 0;

  stageControlTotal.textContent = control.demoRequests;
  stageTreatmentTotal.textContent = treatment.demoRequests;
  stageControlExposures.textContent = control.exposures;
  stageTreatmentExposures.textContent = treatment.exposures;
  stageControlBar.style.width = `${controlBarWidth}%`;
  stageTreatmentBar.style.width = `${treatmentBarWidth}%`;

  if (control.demoRequests === 0 && treatment.demoRequests === 0) {
    experimentStageWinner.textContent = "Waiting for demo requests";
    return;
  }

  if (control.demoRequests === treatment.demoRequests) {
    experimentStageWinner.textContent = "Control and treatment are tied";
    return;
  }

  experimentStageWinner.textContent =
    treatment.demoRequests > control.demoRequests
      ? "Treatment is leading"
      : "Control is leading";
}

function buildExperimentVisitor() {
  const suffix = Math.random().toString(36).slice(2, 8);

  return {
    label: "Experiment visitor",
    shortLabel: "Experiment",
    icon: "◉",
    context: {
      kind: "user",
      key: `experiment-user-${suffix}`,
      name: `Experiment Visitor ${suffix.toUpperCase()}`,
      email: `experiment+${suffix}@abc.example`,
      plan: "free",
      segment: "general-audience",
      country: "IN",
    },
  };
}

function buildCurlSnippet(config) {
  return `curl -X PATCH https://app.launchdarkly.com/api/v2/flags/${config.projectKey || "<project-key>"}/${config.flagKey} \\
  -H "Authorization: <api-token>" \\
  -H "Content-Type: application/json; domain-model=launchdarkly.semanticpatch" \\
  -d '{
    "comment": "Triggered from demo runbook",
    "environmentKey": "${config.environmentKey || "<environment-key>"}",
    "instructions": [{ "kind": "turnFlagOff" }]
  }'`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function personaButtonSubtitle(context) {
  if (context.key === "anonymous-visitor") {
    return "Baseline audience";
  }

  if (context.key === "pilot-account-manager") {
    return "Individually targeted";
  }

  if (context.key.startsWith("experiment-user-")) {
    return "Fresh experiment traffic";
  }

  return "Rule-matched by country";
}

function personaAudienceText(context) {
  if (context.key === "anonymous-visitor") {
    return "General traffic";
  }

  if (context.key === "pilot-account-manager") {
    return "Beta preview";
  }

  if (context.key.startsWith("experiment-user-")) {
    return "Experiment traffic";
  }

  return "Rule-based release";
}

function personaOutcomeText(context) {
  if (context.key === "anonymous-visitor") {
    return "Expected baseline";
  }

  if (context.key.startsWith("experiment-user-")) {
    return "Eligible for experiment";
  }

  return "Expected revamped";
}

function personaSummaryText(context) {
  if (context.key === "anonymous-visitor") {
    return "General audience traffic. This persona should stay on the stable baseline experience unless you change the default targeting rule.";
  }

  if (context.key === "pilot-account-manager") {
    return "A hand-picked beta persona used to prove individual targeting. When targeted directly in LaunchDarkly, this visitor should get the revamped experience.";
  }

  if (context.key.startsWith("experiment-user-")) {
    return "A fresh untargeted user generated for experimentation. This visitor flows through the default rule, making it much more useful for LaunchDarkly experiment traffic.";
  }

  return "A rule-matched persona from the US. This is the best profile to demonstrate attribute-based targeting and see the new experience light up.";
}
