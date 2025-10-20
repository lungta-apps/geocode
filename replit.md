# Montana Property Geocode Lookup

## Overview

This full-stack web application allows users to look up Montana property information using geocodes. It extracts physical addresses from the Montana State Library cadastral database, displays address details, and visualizes the location on an interactive map with precise coordinates. The application features a React frontend, an Express backend, and primarily uses the official Montana ArcGIS REST API for data retrieval, with fallback mechanisms. The project aims to provide a fast, reliable, and user-friendly tool for accessing Montana property data, significantly improving upon previous, slower methods.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is a React application built with TypeScript, emphasizing a component-based structure. It leverages Vite for rapid development, Wouter for lightweight routing, and TanStack Query for efficient server state management. Styling is handled by Tailwind CSS and shadcn/ui, providing a consistent dark mode theme. Form management uses React Hook Form with Zod for validation. The application includes robust features for interactive map markers, including customizable icons, colors, and notes, all persistently stored in localStorage. It also supports draggable text labels and batch editing for multiple selected markers, with all formatting implemented client-side.

### Backend Architecture
The backend is an Express.js application written in TypeScript, following a RESTful API design. It primarily uses the official Montana ArcGIS REST API for property lookups, with a multi-strategy system that includes HTTP fallback scraping and a known properties database. The backend incorporates Zod for input and response validation and centralized error handling. It's designed for deployment compatibility with pure Node.js, removing external Python/Playwright dependencies. WebSocket-based progress tracking is implemented for real-time updates during batch processing.

### Data Storage Solutions
The application currently operates without a persistent database for property data, fetching information on-demand. Minimal in-memory storage is used, and client-side data like marker formats and labels are persisted using browser localStorage. Infrastructure for PostgreSQL sessions is present but not actively used for property data.

### Property Data Integration
Property data is primarily sourced from the official Montana State GIS Service ArcGIS REST API (`gisservicemt.gov`). A fallback mechanism exists using HTTP requests to the Montana State Library Cadastral Database, and a tertiary fallback uses a database of known properties. The system is entirely Node.js-based, ensuring deployment compatibility and fast response times.

### Interactive Mapping
The application utilizes React Leaflet with OpenStreetMap tiles for its interactive map. It displays property parcel boundaries using polygon geometry data from the Montana API and includes precise coordinate information. The map features multi-property display, dynamic color coding, an interactive legend, and auto-fits bounds to show all displayed properties. Custom controls and responsive design ensure usability across devices.

### API Design
The REST API provides a `POST /api/property/lookup` endpoint that accepts geocodes and returns property information. It uses Zod for input validation and provides consistent JSON responses with appropriate HTTP status codes for success and error handling.

### Accessibility Features
The application aims for WCAG AA accessibility compliance through semantic HTML, ARIA attributes, keyboard navigation, screen reader support, visible focus indicators, and sufficient color contrast in its dark theme.

## External Dependencies

### Third-Party Services
- **Montana State GIS Service**: Official ArcGIS REST API at `https://gisservicemt.gov/arcgis/rest/services/`
- **Montana State Library Cadastral Database**: Fallback via `https://svc.mt.gov/msl/cadastral/`
- **OpenStreetMap**: Map tiles and geocoding services.
- **CDN Resources**: Leaflet CSS and marker icons.

### Key NPM Packages
- **@tanstack/react-query**: Server state management.
- **react-leaflet**: Interactive mapping.
- **@radix-ui/**: Accessible UI component primitives.
- **react-hook-form**: Form state management.
- **zod**: Runtime type validation.
- **tailwindcss**: CSS framework.
- **wouter**: Lightweight React routing.
- **lucide-react**: Vector icons.

### Runtime Dependencies
- **Node.js**: Server runtime environment.