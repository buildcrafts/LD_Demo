# LaunchDarkly Demo

This project implements the two required parts of the assignment in a single JavaScript application:

- Part 1: Release and remediate
- Part 2: Target a feature to specific contexts
- Extra credit: Experimentation

The app is intentionally small so the LaunchDarkly behavior is easy to explain in a live demo.

## What this app demonstrates

### Part 1: Release and remediate

- A boolean feature flag wraps a landing page component.
- When the flag changes, the page updates immediately without a refresh.
- The old and new experiences are clearly separated, so rollback is easy to show.
- Release and remediation can be demonstrated three ways:
  - Turn the flag on or off in the LaunchDarkly UI
  - Use the provided cURL command pattern
  - Optionally click the in-app release and remediation buttons if you configure a LaunchDarkly API token on the server

### Part 2: Target

- The page can switch between multiple sample contexts using `identify()`.
- One context is intended for individual targeting:
  - `pilot-account-manager`
- One context is intended for rule-based targeting:
  - `country = US`
- One context is the default audience and should receive the baseline experience.

### Extra credit: Experimentation

- The same `revamped-hero` flag can also be used in a LaunchDarkly experiment.
- The app tracks:
  - `hero-variation-viewed` for exposure
  - `hero-demo-requested` as the primary conversion metric
- The UI includes a live comparison board plus experiment-traffic helpers so you can generate realistic demo traffic.

## Why I chose this implementation

The assignment is about demonstrating LaunchDarkly concepts, not building a complex product. Because of that, I kept the project focused:

- A tiny Node server serves the page and exposes safe browser config.
- The browser LaunchDarkly SDK handles evaluation and real-time updates.
- The browser never receives the optional API token used for remediation.

This makes the architecture easy to explain and safe by default.

## Prerequisites

- Node.js 18 or newer
- A LaunchDarkly trial or existing account
- A LaunchDarkly environment with a client-side ID

## 1. Install dependencies

```bash
npm install
```

## 2. Create local environment configuration

Copy `.env.example` to `.env` and replace the placeholders:

```bash
cp .env.example .env
```

Required values:

- `LD_CLIENT_SIDE_ID`
- `LD_FLAG_KEY`

Optional values for the in-app release and remediation controls:

- `LD_PROJECT_KEY`
- `LD_ENV_KEY`
- `LD_API_TOKEN`

Important:

- `LD_CLIENT_SIDE_ID` is safe for the browser.
- `LD_API_TOKEN` is not safe for the browser. This project keeps it server-side only.

## 3. Create the LaunchDarkly flag

Create a boolean flag in LaunchDarkly with this key:

```text
revamped-hero
```

Or use whatever you set in `LD_FLAG_KEY`.

When configuring the flag:

1. Make sure the flag is available to client-side SDKs using the client-side ID.
2. Keep the off variation mapped to the baseline experience.
3. Keep the on variation mapped to the revamped experience.

## 4. Configure targeting

Use the sample contexts already built into the app.

### Individual targeting

Add an individual target for this context key:

```text
pilot-account-manager
```

Serve the `true` variation to that context.

### Rule-based targeting

Add a targeting rule that serves `true` when:

- `country` is `US`

This allows the `enterprise-designer` context to receive the new experience through an attribute-based rule that is easy to configure in the LaunchDarkly UI.

### Default audience

Leave the anonymous visitor on the baseline experience.

## 5. Run the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## How to demo the assignment

### Demo Part 1: Release and remediate

1. Start the app and confirm the SDK connects.
2. Show the baseline component.
3. Turn the flag on in LaunchDarkly, or click the in-app `Simulate release: turn flag on` button if API credentials are configured.
4. Observe that the page swaps to the new component without a reload.
5. Turn the flag off again:
   - in the LaunchDarkly UI, or
   - with the cURL command shown in the app, or
   - with the in-app `Simulate incident: turn flag off` button if API credentials are configured
6. Observe that the page instantly returns to the baseline component.

### Demo Part 2: Targeting

1. Select `Anonymous visitor` and show the baseline experience.
2. Select `Individually targeted pilot account manager` and show the targeted experience.
3. Select `Rule-based US design partner` and show the rule-based experience.
4. Explain that switching profiles uses LaunchDarkly `identify()` to re-evaluate the same flag for a different context.

### Demo Part 3: Experimentation

1. Keep using the same `revamped-hero` flag.
2. In LaunchDarkly, create a metric using this event key:
   - `hero-demo-requested`
3. Create an experiment on `revamped-hero` and attach the metric.
4. Use `user` as the randomization unit.
5. Run the experiment on the `Default Rule` so untargeted users are eligible for the experiment.
6. In the app, use:
   - `Generate experiment visitor` to create one fresh untargeted user
   - `Simulate demo request` to record the conversion for that user
   - `Generate 100 experiment visitors` to create experiment traffic faster
7. Refresh the LaunchDarkly Results page after 1-2 minutes and confirm that:
   - exposures are increasing
   - both `true` and `false` variations are receiving traffic
   - the `Demo requests` metric is being attributed to the experiment

This gives you a full “measure impact” story on top of the existing release and targeting demo.

## Project structure

- `server.js`: serves the app, exposes browser-safe config, and optionally calls the LaunchDarkly REST API for remediation
- `public/index.html`: app structure
- `public/styles.css`: UI styling
- `public/app.js`: LaunchDarkly client setup, live updates, targeting demo, and event tracking

## Code walkthrough

### Live release and rollback

The browser SDK is initialized once and subscribed to:

- `change:<flag-key>`

When that event fires, the app re-renders the component immediately. This satisfies the “listener” requirement and avoids a page refresh.

### Targeting

The app includes multiple sample contexts. When the visitor selector changes, the app calls:

```js
client.identify(nextContext)
```

That tells LaunchDarkly to evaluate the same flag for a different user profile.

### Experimentation

The app tracks two experiment-friendly events:

- `hero-variation-viewed`
- `hero-demo-requested`

The first event acts as an exposure signal when a user lands in a variation. The second represents the outcome you want to improve.

The app includes two experiment helpers:

- `Generate experiment visitor`
  Creates a fresh untargeted user key so the visitor flows through the experiment on the default rule instead of through individual or rule-based targeting.
- `Generate 100 experiment visitors`
  Creates many fresh users in sequence and records demo-request events so LaunchDarkly has enough traffic to start showing experiment movement.

This makes it straightforward to create a metric in LaunchDarkly and run an experiment using the same feature flag.

### Release and remediation

If `LD_API_TOKEN`, `LD_PROJECT_KEY`, and `LD_ENV_KEY` are configured, the server can send semantic patch requests to the LaunchDarkly REST API that turn the flag on or off. This is optional because the assignment can also be demonstrated through the LaunchDarkly UI.

The in-app controls map to these LaunchDarkly actions:

- `Simulate release: turn flag on` -> `turnFlagOn`
- `Simulate incident: turn flag off` -> `turnFlagOff`

## Assumptions

- The evaluator running this project has permission to create flags and targeting rules in LaunchDarkly.
- The flag is boolean.
- The evaluator is comfortable using a local `.env` file.
- The evaluator wants a single-page demo instead of a multi-route application because the main goal is to show LaunchDarkly behavior clearly.
