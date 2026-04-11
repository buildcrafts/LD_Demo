

# LaunchDarkly Demo

A sample LaunchDarkly demo app that shows:

- live feature release and rollback
- individual targeting
- rule-based targeting
- a safe baseline experience when the flag is off

This project was built as a LaunchDarkly technical exercise using the JavaScript browser SDK.

## What this app demonstrates

### Part 1: Release and remediate

- A boolean feature flag wraps a landing page component.
- When the flag changes in LaunchDarkly, the page updates immediately without a browser refresh.
- Turning the flag off rolls the app back to the stable baseline experience.

### Part 2: Target

- The app can switch between multiple sample users using `identify()`.
- One user is individually targeted.
- One user is targeted through a rule-based attribute match.
- Everyone else stays on the baseline experience.

## Tech stack

- Node.js
- LaunchDarkly JavaScript client-side SDK
- Plain HTML, CSS, and JavaScript

## Project structure

- `server.js`
  Serves the app, loads `.env`, exposes browser-safe config, and optionally supports remediation.
- `public/index.html`
  Main app markup.
- `public/styles.css`
  Styling for the demo UI.
- `public/app.js`
  LaunchDarkly initialization, targeting logic, live flag updates, and UI rendering.
- `.env.example`
  Template for local environment variables.

## Prerequisites

Before running this app, make sure you have:

- Node.js 18 or newer
- A LaunchDarkly account
- Access to a LaunchDarkly project/environment
- A client-side ID for that LaunchDarkly environment

## 1. Clone and install

```bash
git clone https://github.com/buildcrafts/LD_Demo.git
cd LD_Demo
npm install
```

## 2. Create local environment file

Create a `.env` file in the project root.

You can copy the template:

```bash
cp .env.example .env
```

Then update `.env` to look like this:

```env
PORT=3000
LD_CLIENT_SIDE_ID=your-client-side-id
LD_FLAG_KEY=revamped-hero
LD_PROJECT_KEY=default
LD_ENV_KEY=test
```

Optional, only needed for the in-app remediation button:

```env
LD_API_TOKEN=your-launchdarkly-api-token
```

Important:
- `LD_CLIENT_SIDE_ID` must be the client-side ID from the exact LaunchDarkly environment where your flag exists.
- `.env` is ignored by git and should not be committed.

## 3. Configure LaunchDarkly

### Create the flag

In LaunchDarkly, create a boolean flag with:

- Name: `Revamped Hero`
- Key: `revamped-hero`

### Make it available to the browser SDK

Open the flag settings and make sure:

- `Available on client-side SDKs` is turned on

### Confirm the variations

This app expects:

- `true` = revamped experience
- `false` = baseline experience

### Configure targeting

Use the `Test` environment or whichever environment matches your `LD_CLIENT_SIDE_ID`.

Set the targeting rules like this:

#### Individual target

Add an individual target:

- Context kind: `user`
- Context key: `pilot-account-manager`
- Variation: `true`

#### Rule-based target

Add a custom rule:

- If `user.country` is one of `US`
- Serve `true`

#### Default rule

Set the default rule to:

- Serve `false`

## 4. Run the app

Start the local server:

```bash
npm run dev
```

Open the app in your browser:

```text
http://localhost:3000
```

## 5. How to use the demo

The app includes 3 sample users:

1. `Anonymous visitor`
   - Expected result: baseline experience

2. `Individually targeted pilot account manager`
   - Expected result: revamped experience

3. `Rule-based US design partner`
   - Expected result: revamped experience because `country = US`

## 6. How to demonstrate live rollout and rollback

1. Open the app in the browser.
2. Open the `revamped-hero` flag in LaunchDarkly.
3. Toggle the flag on or off.
4. Watch the app update immediately without reloading the page.

This works because the browser SDK listens for LaunchDarkly flag change events and re-renders the component live.

## 7. Optional remediation flow

This project also supports an optional remediation button.

If you set these values in `.env`:

```env
LD_API_TOKEN=your-launchdarkly-api-token
LD_PROJECT_KEY=default
LD_ENV_KEY=test
```

the app can call the LaunchDarkly REST API and turn the flag off from the UI.

If you do not configure this, the app still works fully for:
- flag evaluation
- live updates
- targeting
- manual rollback through LaunchDarkly

## 8. Notes

- If the app shows `Missing config`, your `.env` file is missing or not named correctly.
- If the app connects but targeting does not work, verify that:
  - the client-side ID belongs to the same LaunchDarkly environment as the flag
  - the flag key is `revamped-hero`
  - the flag is enabled for client-side SDKs
  - the targeting rules were saved in the correct environment

## Summary

This demo shows how LaunchDarkly can be used to:

- release features safely
- target features to specific users or segments
- rollback instantly without redeploying
- keep a stable default experience for non-targeted users
```

