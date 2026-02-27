# DC Bus Route

A web application for navigating public bus transportation in Davao City, Philippines. Features an interactive map, trip planning with route recommendations, and an AI-powered chatbot assistant.

![Status](https://img.shields.io/badge/Status-Prototype-yellow)
![License](https://img.shields.io/badge/License-MIT-blue)

## Demo

[Live Demo](https://dc-bus-route.vercel.app)

## Features

- **Interactive Route Map** - Leaflet-based map displaying all DC Bus routes with color-coded visualization
- **Trip Planning** - Input origin and destination to get route recommendations with estimated duration and distance
- **AI Chatbot Assistant** - Powered by Google Gemini to answer questions about routes, stops, and directions
- **Real-time Navigation** - Step-by-step guidance with trip milestones and status tracking
- **Geolocation Support** - Find nearby bus stops based on your current location
- **Responsive Design** - Mobile-optimized with swipeable bottom sheets and floating action buttons
- **Dark Mode** - Full dark theme support

## Tech Stack

- **Framework**: Next.js 14, React 18, TypeScript
- **Mapping**: Leaflet, React Leaflet
- **Styling**: Tailwind CSS, Radix UI
- **AI**: Google Generative AI (Gemini)
- **Backend**: Supabase
- **State Management**: Zustand

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/dc-bus-route.git
   cd dc-bus-route
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables

   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   ```

4. Run the development server
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── page.tsx        # Home/landing page
│   ├── route-map/      # Main route map page
│   └── chatbot/        # AI chatbot page
├── components/          # React components
│   ├── Map.tsx         # Leaflet map component
│   ├── navigation/     # Navigation feature components
│   └── ui/             # Reusable UI components
├── lib/                 # Utility libraries
│   ├── route-algorithm.ts  # Route finding algorithm
│   ├── geo-utils.ts    # Geospatial utilities
│   └── chatbot.ts      # AI chatbot logic
├── stores/              # Zustand state stores
└── data/                # Route and stop data (GeoJSON)
```

## Authors

- Antonio De Jesus
- Kieffer Devera

## Acknowledgments

- DC Bus route data sourced from [MetroDreamin](https://metrodreamin.com/user/jg0ExjCKlehQTGMyeU7gTtGxsph2)

## License

This project is licensed under the MIT License.
