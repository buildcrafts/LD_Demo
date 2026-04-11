import { basicLogger, createClient } from "/vendor/launchdarkly-sdk.js";

const sampleContexts = [
  {
    label: "Anonymous visitor",
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
};

const connectionStatus = document.querySelector("#connection-status");
const flagKey = document.querySelector("#flag-key");
const flagState = document.querySelector("#flag-state");
const contextSelect = document.querySelector("#context-select");
const contextDetails = document.querySelector("#context-details");
const experienceRoot = document.querySelector("#experience-root");
const eventLog = document.querySelector("#event-log");
const remediateButton = document.querySelector("#remediate-button");
const remediationMessage = document.querySelector("#remediation-message");
const curlSnippet = document.querySelector("#curl-snippet");
const primaryCta = document.querySelector("#primary-cta");
const secondaryCta = document.querySelector("#secondary-cta");

boot();

async function boot() {
  populateContextSelector();
  renderContextDetails(state.currentContext);

  state.config = await fetchJson("/api/config");
  flagKey.textContent = state.config.flagKey;
  curlSnippet.textContent = buildCurlSnippet(state.config);
  remediateButton.disabled = !state.config.canRemediate;
  remediationMessage.textContent = state.config.canRemediate
    ? "The button is wired to the LaunchDarkly REST API through the local server."
    : "Optional: add LD_API_TOKEN, LD_PROJECT_KEY, and LD_ENV_KEY to enable the in-app kill switch.";

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

contextSelect.addEventListener("change", async (event) => {
  const selected = sampleContexts[Number(event.target.value)];
  state.currentContext = selected.context;
  renderContextDetails(state.currentContext);

  if (!state.client) {
    renderDisconnectedExperience();
    return;
  }

  logEvent(`Switching context to "${selected.label}" via identify().`);
  const result = await state.client.identify(state.currentContext);

  if (result.status !== "success") {
    logEvent(`identify() did not complete successfully: ${result.status}.`);
  }

  syncVariation(`Re-evaluated flag for "${selected.label}".`);
});

secondaryCta.addEventListener("click", () => {
  syncVariation("Variation checked manually.");
});

primaryCta.addEventListener("click", async () => {
  if (!state.client) {
    return;
  }

  state.client.track("hero-cta-clicked", {
    flagEnabled: state.flagValue,
    country: state.currentContext.country,
    email: state.currentContext.email,
  });
  await state.client.flush();
  logEvent("Tracked a CTA click event for experimentation/metrics follow-up.");
});

remediateButton.addEventListener("click", async () => {
  remediationMessage.textContent = "Turning the flag off...";

  try {
    const response = await fetch("/api/remediate", { method: "POST" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.detail || payload.error || "Remediation failed");
    }

    remediationMessage.textContent = payload.message;
    logEvent("Remediation endpoint called successfully. The flag should turn off almost immediately.");
  } catch (error) {
    remediationMessage.textContent = error.message;
    logEvent(`Remediation failed: ${error.message}`);
  }
});

function populateContextSelector() {
  contextSelect.innerHTML = sampleContexts
    .map(
      (entry, index) => `<option value="${index}">${entry.label}</option>`,
    )
    .join("");
}

function renderContextDetails(context) {
  contextDetails.innerHTML = Object.entries(context)
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`)
    .join("");
}

function syncVariation(reason) {
  if (!state.client) {
    return;
  }

  state.flagValue = state.client.variation(state.config.flagKey, false);
  flagState.textContent = state.flagValue ? "Revamped experience" : "Baseline experience";
  flagState.className = `pill ${state.flagValue ? "pill-on" : "pill-off"}`;
  renderExperience();
  logEvent(`${reason} LaunchDarkly returned ${state.flagValue}.`);
}

function renderExperience() {
  if (state.flagValue) {
    experienceRoot.innerHTML = `
      <article class="experience-card new">
        <div class="experience-body">
          <span class="badge">New experience enabled</span>
          <h3>AI-guided product tour</h3>
          <p>
            The revamped component gives visitors a more guided onboarding path with role-aware
            messaging, stronger calls to action, and richer product signals.
          </p>
          <div class="feature-grid">
            <div class="feature-tile">
              <strong>Role-aware recommendations</strong>
              <p>Context attributes shape the way the component speaks to this visitor.</p>
            </div>
            <div class="feature-tile">
              <strong>Shorter time to value</strong>
              <p>Focused messaging helps high-value audiences reach the right workflow faster.</p>
            </div>
            <div class="feature-tile">
              <strong>Safer rollout</strong>
              <p>The experience can be turned off instantly if a production issue appears.</p>
            </div>
          </div>
        </div>
      </article>
    `;
    return;
  }

  experienceRoot.innerHTML = `
    <article class="experience-card old">
      <div class="experience-body">
        <span class="badge">Baseline experience</span>
        <h3>Classic landing page component</h3>
        <p>
          This is the stable production version. It is simpler, lower risk, and acts as the safe
          rollback target whenever the flag is off.
        </p>
        <div class="feature-grid">
          <div class="feature-tile">
            <strong>Static headline</strong>
            <p>A dependable control experience for general traffic.</p>
          </div>
          <div class="feature-tile">
            <strong>Known-good UI</strong>
            <p>This mirrors the “old code path” required by the assignment.</p>
          </div>
          <div class="feature-tile">
            <strong>Fast rollback</strong>
            <p>If the new feature misbehaves, this version returns immediately.</p>
          </div>
        </div>
      </div>
    </article>
  `;
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
