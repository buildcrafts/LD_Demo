# LaunchDarkly Demo

A small LaunchDarkly demo app that uses one feature flag, `revamped-hero`, to show:

- safe release and rollback
- user targeting
- experimentation

Built with a tiny Node server and the LaunchDarkly browser SDK, the app is intentionally lightweight so the LaunchDarkly flow is easy to understand and easy to run locally.

The LaunchDarkly setup section below covers the exact flag, targeting, and experimentation configuration used by the demo.

## What this demo shows

### 1. Release and remediate

- A boolean flag controls whether the page renders the baseline hero or the revamped hero.
- When the flag changes in LaunchDarkly, the UI updates immediately without a page refresh.
- Rollout and rollback can be demonstrated from the LaunchDarkly UI or the optional in-app release/remediation controls.

### 2. Target a feature

- The app switches between built-in sample contexts using `identify()`.
- One context is individually targeted: `pilot-account-manager`
- One context is rule-targeted: `country = US`
- The anonymous visitor remains on the baseline experience.

### 3. Measure impact with experimentation

- The same `revamped-hero` flag is reused for an experiment.
- The experiment compares control = baseline hero vs treatment = revamped hero.
- The primary metric is `hero-demo-requested`.

## Why this implementation

This project is designed to make the LaunchDarkly flow easy to understand:

- a tiny Node server serves the app and exposes browser-safe config
- the LaunchDarkly browser SDK handles live flag evaluation and streaming updates
- the optional REST API integration stays server-side so secrets are not exposed in the browser

That keeps the architecture simple, safe, and easy to explain.

## Quick start

### Prerequisites

- Node.js 18 or newer
- A LaunchDarkly account
- A LaunchDarkly environment with a client-side ID

### Environment assumptions

- The app is run locally on `localhost:3000`
- The user can create or edit flags, targeting rules, metrics, and experiments in LaunchDarkly
- The feature flag used by the app is a boolean flag named `revamped-hero`, unless `LD_FLAG_KEY` is changed
- Optional in-app release/remediation controls require a server-side LaunchDarkly API token

### Install

```bash
npm install
```

### Local configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required values for the browser flag demo:

- `LD_CLIENT_SIDE_ID`
- `LD_FLAG_KEY`

Additional values required for in-app release/remediation:

- `LD_PROJECT_KEY`
- `LD_ENV_KEY`
- `LD_API_TOKEN`

Notes:

- `LD_CLIENT_SIDE_ID` is safe for the browser.
- `LD_API_TOKEN` is secret and is only used server-side.

### How to find these values in LaunchDarkly

#### `LD_CLIENT_SIDE_ID`

1. Open your LaunchDarkly project.
2. Go to `Project settings` -> `Environments`.
3. Open the environment you want to use, for example `Test`.
4. Copy the `Client-side ID`.

#### `LD_PROJECT_KEY`

You can find the project key in either of these places:

- `Project settings`
- the LaunchDarkly URL, where it appears as `/projects/<project-key>/...`

#### `LD_ENV_KEY`

1. Go to `Project settings` -> `Environments`.
2. Open the environment you are using.
3. Copy the environment key.

#### `LD_API_TOKEN`

1. Open LaunchDarkly settings.
2. Go to `Authorization`.
3. Open `Access tokens`.
4. Create a token with permission to update flags in your project/environment.
5. Copy the token and store it in `.env`.

### Run the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## LaunchDarkly setup

### Create the flag

Create a boolean flag with key:

```text
revamped-hero
```

Or use whatever value you place in `LD_FLAG_KEY`.

### Enable client-side evaluation

Make sure the flag is available to client-side SDKs using the client-side ID.

### Configure targeting

Use the sample contexts already built into the app.

#### Individual target

Target this context key with variation `true`:

```text
pilot-account-manager
```

#### Rule-based target

Add a rule that serves `true` when:

```text
country = US
```

This allows the `enterprise-designer` context to receive the revamped experience.

#### Default rule

Leave the anonymous visitor on the baseline experience.

## Demo walkthrough

### Release and rollback

1. Start the app and confirm the LaunchDarkly SDK connects.
2. Show the baseline experience.
3. Turn the flag on in LaunchDarkly, or use the in-app release button if API credentials are configured.
4. Show that the page swaps to the revamped experience without a refresh.
5. Turn the flag off again.
6. Show that the app instantly returns to the baseline experience.

### Targeting

1. Select `Anonymous visitor` and show the baseline experience.
2. Select `Individually targeted pilot account manager` and show the targeted experience.
3. Select `Rule-based US design partner` and show the rule-based experience.
4. Explain that switching personas calls LaunchDarkly `identify()` to re-evaluate the same flag for a different context.

### Experimentation

1. Create a LaunchDarkly metric using:
   - `hero-demo-requested`
2. Create an experiment on `revamped-hero`.
3. Use `user` as the randomization unit.
4. Run the experiment on the `Default Rule` so untargeted users are eligible.
5. In the app, use:
   - `Generate experiment visitor`
   - `Simulate demo request`
   - `Generate 100 experiment visitors`
6. Refresh the LaunchDarkly Results page after a short delay and confirm:
   - exposures increase
   - both `true` and `false` receive traffic
   - the `Demo requests` metric is attributed to the experiment

This gives a complete story: release the feature, target it safely, then measure whether it actually performs better.

## Project structure

- `server.js`  
  Tiny Node server that serves the app, exposes browser-safe config, and optionally calls the LaunchDarkly REST API for release/remediation.
- `public/index.html`  
  App structure and demo sections.
- `public/styles.css`  
  Visual styling and transitions.
- `public/app.js`  
  LaunchDarkly client initialization, live updates, targeting flow, experimentation helpers, and event tracking.

## Code walkthrough

### Live flag updates

The browser SDK subscribes to:

- `change:<flag-key>`

When the flag changes, the app re-renders immediately. This is what makes the no-refresh rollout and rollback demo work.

### Targeting

The app includes multiple sample contexts. When the selected persona changes, the app calls:

```js
client.identify(nextContext)
```

That tells LaunchDarkly to evaluate the same flag for a different user profile.

### Experimentation

The app sends two experiment-related events:

- `hero-variation-viewed`
- `hero-demo-requested`

The first acts as a variation-view signal. The second is the outcome metric used in LaunchDarkly experimentation.

The app also includes experiment traffic helpers:

- `Generate experiment visitor`
  Creates a fresh untargeted user so the user flows through the experiment path cleanly.
- `Generate 100 experiment visitors`
  Generates many fresh users in sequence and records demo-request events so experiment data becomes visible faster.

### Release/remediation API flow

If `LD_API_TOKEN`, `LD_PROJECT_KEY`, and `LD_ENV_KEY` are configured, the server can send semantic patch requests to the LaunchDarkly REST API to turn the flag on or off.

The in-app controls map to:

- `Simulate release: turn flag on` -> `turnFlagOn`
- `Simulate incident: turn flag off` -> `turnFlagOff`

## Notes

- The app is intentionally small and demo-focused rather than production-complete.
- The experimentation traffic helpers are included to make LaunchDarkly experiment results visible during a live demo.
- The same feature flag is reused across release, targeting, and experimentation to keep the story cohesive.
