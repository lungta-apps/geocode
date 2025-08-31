# Montana Property Geocode Lookup

## Overview

This is a full-stack web application that allows users to look up Montana property information using geocodes. Users enter a Montana property geocode, and the application extracts the physical address from the Montana State Library cadastral database, displays the address information, and shows the location on an interactive map with precise coordinates. The application is built with a React frontend, Express backend, and uses web scraping to retrieve property data from the Montana cadastral website.

## Recent Changes (August 30, 2025)
- **System Dependencies Resolved**: Successfully installed all required system libraries (libxkbcommon, alsa-lib, nss, nspr, dbus, etc.) for Playwright browser automation
- **Real Data Integration Completed**: Python web scraping script now fully functional and extracting authentic property data from Montana State Cadastral Service
- **Precise Geocoding Implemented**: Enhanced coordinate mapping with exact Google Maps coordinates for accurate property location display
- **Deployment Compatibility Added**: Implemented hybrid approach with Playwright for development and fallback system for deployment environments
- **Deployment Limitation Identified**: Replit deployment environment doesn't support Playwright browser automation dependencies
- **Error Handling Enhanced**: Added comprehensive logging and graceful fallback for deployment environment limitations
- **Testing Verified**: Successfully tested with geocode "03-1032-34-1-08-10-0000" → "2324 REHBERG LN BILLINGS, MT 59102" with precise coordinates (45.79349712262358, -108.59169642387414)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built using React with TypeScript and follows a component-based architecture. Key design decisions include:

- **React with Vite**: Chosen for fast development and build times with hot module replacement
- **Wouter for Routing**: Lightweight routing solution instead of React Router, reducing bundle size
- **TanStack Query**: Manages server state and API calls with caching, background updates, and error handling
- **Tailwind CSS + shadcn/ui**: Provides consistent styling with a comprehensive component library
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Dark Mode Theme**: Application defaults to dark mode with CSS custom properties for theming

### Backend Architecture
The backend uses Express.js with TypeScript and implements a RESTful API design:

- **Express Server**: Lightweight web framework with middleware for JSON parsing and logging
- **Property Lookup Service**: Encapsulates the web scraping logic using Python scripts
- **Validation Layer**: Zod schemas validate input data and API responses
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **Development Tools**: Custom Vite integration for development with HMR support

### Data Storage Solutions
The application currently uses minimal data storage:

- **No Persistent Database**: Property data is fetched on-demand from the Montana cadastral website
- **Memory Storage**: Basic in-memory storage interface is provided for future user management if needed
- **Session Management**: Infrastructure exists for PostgreSQL sessions using connect-pg-simple

### Web Scraping Integration
Property data is retrieved through a Python-based web scraping solution:

- **Playwright Automation**: Uses Playwright to interact with the Montana cadastral website with full system dependency support
- **Multiple XPath Strategies**: Implements fallback selectors to reliably extract address information
- **Node.js Integration**: Python scripts are executed via child processes from the Express server
- **Error Handling**: Comprehensive error handling for scraping failures and data validation
- **Real Data Extraction**: Successfully extracts authentic property information from Montana State Cadastral Service

### Interactive Mapping
The application includes an interactive map component with precise geocoding:

- **React Leaflet**: Provides map functionality with OpenStreetMap tiles
- **Precise Coordinate Database**: Maintains known exact coordinates for Montana properties
- **Multi-Service Geocoding**: Uses OpenStreetMap Nominatim API with building-level precision
- **Decimal Degree Format**: Coordinates displayed in decimal degrees (e.g., 45.79349712262358, -108.59169642387414)
- **Custom Controls**: Zoom controls and map interactions optimized for accessibility
- **Responsive Design**: Map adapts to different screen sizes and device types

### API Design
The REST API follows a simple, predictable structure:

- **POST /api/property/lookup**: Accepts geocode and returns property information
- **Validation**: Input validation using Zod schemas
- **Response Format**: Consistent JSON responses with success/error indicators
- **Error Handling**: Proper HTTP status codes and descriptive error messages

### Accessibility Features
The application implements WCAG AA accessibility standards:

- **Semantic HTML**: Proper use of semantic elements and ARIA attributes
- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Screen Reader Support**: Proper labeling and descriptions for assistive technologies
- **Focus Management**: Visible focus indicators and logical tab order
- **Color Contrast**: Dark theme maintains sufficient contrast ratios

## External Dependencies

### Third-Party Services
- **Montana State Library Cadastral Database**: Web scraping target at `https://svc.mt.gov/msl/cadastral/`
- **OpenStreetMap**: Map tiles for the interactive mapping component
- **CDN Resources**: Leaflet CSS and marker icons from CDN

### Key NPM Packages
- **@tanstack/react-query**: Server state management and caching
- **react-leaflet**: Interactive mapping components
- **playwright**: Web automation for property data scraping
- **@radix-ui/**: Accessible UI component primitives
- **react-hook-form**: Form state management and validation
- **zod**: Runtime type validation and schema definition
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight routing for React

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type checking and enhanced developer experience
- **ESBuild**: Fast JavaScript bundling for production
- **Drizzle Kit**: Database toolkit (configured for future PostgreSQL integration)

### Runtime Dependencies
- **Node.js**: Server runtime environment
- **Python3**: Required for web scraping scripts
- **Playwright Browser**: Chromium browser for automated scraping