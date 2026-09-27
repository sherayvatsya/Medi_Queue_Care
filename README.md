# Medi-Queue

Medi-Queue is an in-hospital smart queue and AI-assisted care coordination platform. It helps patients track their OPD visit, access teleconsultation and hospital wayfinding tools, while giving hospital staff a live view of queues, doctors, patients, reports, and accessibility requests.

## Live Demo

**Deployed website:** [Paste your deployed website link here](https://your-deployed-website-url.com)

Replace the placeholder URL above with the public URL of your deployed Medi-Queue application.

## Features

### Patient experience

- **Digital patient pass:** View a queue token, current position, estimated wait, doctor details, and live consultation status from one place.
- **Secure patient access:** Sign in with Google and maintain a reusable patient profile with contact, health, and emergency information.
- **Appointment rescheduling:** Request a new appointment time and preserve each change in a rescheduling audit trail.
- **Teleconsultation:** Access a dedicated remote consultation workflow when an in-person visit is not required.
- **Hospital discovery and wayfinding:** Find nearby hospitals and use interactive map views to locate services and navigate the facility.
- **Accessibility assistance:** Submit wheelchair and porter requests so hospital staff can coordinate support during the visit.
- **Live notifications:** Receive queue progress, urgent alerts, and hospital updates through in-app notifications and audio cues.

### Hospital staff experience

- **Role-protected access:** Use a dedicated hospital staff login to keep operational tools separate from the patient experience.
- **Live staff dashboard:** Monitor queue telemetry, active consultations, waiting times, and operational activity.
- **Queue and patient management:** Review patient tokens, update queue progress, and manage patient records from a central workspace.
- **Doctor availability:** Track doctor status and update availability so patients receive more accurate queue information.
- **Reports and analytics:** Review operational data to identify bottlenecks and support better resource planning.
- **Hospital profile management:** Maintain hospital information and service details shown to patients.
- **Firestore synchronization:** Keep patient, doctor, queue, accessibility, and audit data synchronized across supported views.

## Technology

- React 19 and TypeScript
- Vite
- Firebase Authentication and Cloud Firestore
- Google Maps and Leaflet/OpenStreetMap
- Tailwind CSS
- Lucide React, Motion, jsPDF, and Canvas Confetti
- Express server entry point for production hosting

## Getting Started

### Prerequisites

- Node.js 18 or newer
- A Firebase project with Authentication and Cloud Firestore enabled

### Installation

```bash
npm install
```

The Firebase web configuration is loaded from `firebase-applet-config.json`. Update that file with the configuration for your Firebase project when using a different project.

### Run locally

```bash
npm run dev
```

Open the local URL shown by Vite, usually `http://localhost:3000`.

### Build for production

```bash
npm run build
```

Preview the production build locally with:

```bash
npm run preview
```

Run the TypeScript check with:

```bash
npm run lint
```

## Project Structure

```text
src/
	api/          API routes and application integrations
	components/   Patient, staff, authentication, map, and modal UI
	data/         Initial doctors, patients, and protocol data
	types/        Shared TypeScript models
	utils/        Audio, avatar, and PDF export helpers
	App.tsx       Main role-based application flow
	firebase.ts   Firebase setup and Firestore operations
```

## Firebase Setup

1. Create or select a Firebase project.
2. Enable Google Authentication.
3. Create a Cloud Firestore database.
4. Add your local and deployed domains to Firebase Authentication authorized domains.
5. Apply the rules in `firestore.rules` before using the application with real data.

The application seeds initial doctor and patient queue data when the relevant Firestore collections are empty. Review the Firestore rules and authentication settings before deploying to production.

## Deployment

Build the application with `npm run build`, then deploy the generated `dist/` directory to a static hosting provider such as Firebase Hosting, Vercel, Netlify, or another service that supports Vite applications.

Update the link in the [Live Demo](#live-demo) section after deployment:

```text
Deployed website: https://your-deployed-website-url.com
```

## License

This project is licensed under the terms in [LICENSE](LICENSE).