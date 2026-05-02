# OrbitXos 3.0 🌍🛰️

OrbitXos 3.0 is a modern, high-performance web application designed for real-time satellite tracking and visualization. Built with React and Vite, it leverages WebGL, advanced animations, and live data to create an immersive orbital tracking experience.

## ✨ Key Features

- **Real-Time 3D Satellite Visualization:** Interactive globe rendering using Three.js, COBE, and OGL.
- **Accurate Orbital Physics:** Satellite trajectory calculation powered by `satellite.js`.
- **Data Analytics Dashboard:** Comprehensive data visualization using Chart.js.
- **Fluid Animations:** Smooth UI transitions and micro-interactions powered by GSAP and Framer Motion.
- **Cloud Integrated:** Real-time data sync and authentication via Firebase.
- **Modern UI/UX:** Styled using Tailwind CSS with beautiful typography (Inter, Orbitron, Poppins).

## 🛠️ Technology Stack

- **Frontend Framework:** React 19 + Vite
- **Styling:** Tailwind CSS v4, Lucide React, React Icons
- **3D & Graphics:** Three.js, COBE, OGL
- **Physics Engine:** satellite.js
- **Animations:** GSAP, Framer Motion, Motion, Tailwind CSS Animate
- **Charts:** Chart.js, react-chartjs-2
- **Backend Services:** Firebase
- **Routing:** React Router v7

## 🚀 Getting Started

Follow these instructions to set up the project locally.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vengatavisva/OrbitXos-3.0.git
   cd OrbitXos-3.0
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Firebase Environment Variables:**
   Create a `.env` file in the root directory and add your Firebase configuration details:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`.

## 📦 Building for Production

To build the application for production, run:
```bash
npm run build
```
This command bundles the app using Vite, optimizing it for the best performance. You can preview the production build using:
```bash
npm run preview
```

## 📜 Scripts Overview

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the app for production.
- `npm run lint`: Runs ESLint to find and fix problems in your code.
- `npm run preview`: Locally previews the production build.
