# Montana Property Geocode Lookup

## Overview

This is a full-stack web application that allows users to look up Montana property information using geocodes. Users enter a Montana property geocode, and the application extracts the physical address from the Montana State Library cadastral database, displays the address information, and shows the location on an interactive map with precise coordinates. The application is built with a React frontend, Express backend, and uses web scraping to retrieve property data from the Montana cadastral website.

## Recent Changes (October 20, 2025)
- **Point Formatting Toolbar**: Added interactive marker customization with icon picker, color picker, and label editor in marker popups
- **Lucide Icon Integration**: Replaced CSS-based icon shapes with actual Lucide React icon components (Home, Building, Flag, Star, Heart, MapPin) for crisp vector rendering
- **Custom Marker Colors**: Added 8-color palette (blue, red, green, orange, purple, pink, teal, yellow) for marker customization
- **Custom Marker Labels**: Text input field allows users to add custom labels to markers that persist in popups
- **LocalStorage Persistence**: All marker formatting (icon/color/label) persists across map size toggles and page reloads using stable geocode keys
- **Real-time Updates**: Marker appearance updates immediately when selecting icons/colors or typing labels
- **Improved Label Editor UX**: Label input uses draft state with save-on-blur/Enter to prevent popup closing while typing
- **Dark Theme Popup Styling**: Map popups now match the app's dark UI with proper contrast, using CSS variables for surface colors, borders, and text
- **Enhanced Toolbar Panels**: Icon/color/label picker panels use dark backgrounds (gray-800) with improved visibility and focus states
- **Accessible Inputs**: Label input field styled with dark background, white text, gray placeholder, and primary focus ring for clear visibility
- **Frontend-only Implementation**: No backend changes required, all formatting stored in browser localStorage
- **SVG Icon Rendering**: Uses ReactDOMServer.renderToString() to convert Lucide icon components to SVG strings for Leaflet divIcon integration

## Previous Changes (September 7, 2025)
- **Multi-Property Map Enhancement**: Extended PropertyMap component to display multiple properties simultaneously with different colored markers and polygons
- **Dynamic Color Coding**: Implemented 12-color palette system that automatically assigns unique colors to each property for easy identification
- **Enhanced Interactive Legend**: Updated map legend to show individual property information with geocodes, addresses, and color-coded indicators
- **Auto-Fit Bounds Optimization**: Map automatically calculates and fits bounds to display all properties with appropriate padding
- **Performance Optimizations**: Added React.memo, useMemo, icon caching, polygon simplification, and 50-property limit for optimal rendering performance
- **Enhanced Input Options**: Added textarea for copy/paste geocode lists, drag & drop CSV file upload, input validation and geocode preview
- **Batch Processing Interface**: Implemented tab-based interface allowing users to mix single geocode and batch processing modes
- **Comprehensive Input Parsing**: Smart parsing handles both plain text lists and CSV formats with header detection and duplicate removal
- **Real-time Preview**: Shows detected geocodes with count before processing, including validation warnings for limits
- **Integrated Results Display**: Batch results automatically display on the enhanced multi-property map with color-coded properties
- **Export and Retry Features**: Added CSV export functionality, individual retry buttons for failed geocodes, and "retry all failed" batch option
- **Comprehensive CSV Export**: Export includes timestamps, processing metadata, batch statistics, and configurable options for successful vs failed results
- **Individual and Batch Retry**: Users can retry individual failed geocodes or retry all failed geocodes at once with real-time status updates
- **Enhanced Metadata Tracking**: Backend now includes batch IDs, processing timestamps, and detailed timing information for audit trails
- **Unified Blue Color Scheme**: Simplified map display to use single blue color (#2196F3) for all properties while maintaining multi-property functionality
- **Real-time Progress Tracking**: Implemented WebSocket-based progress updates with live batch processing status, ETA calculations, and processing rates
- **Enhanced UX Polish**: Added smooth animations, real-time progress indicators, rate limiting for large batches, and polished loading states
- **Advanced Queue Management**: Implemented sequential processing with rate limiting (100ms delays for large batches) and intelligent time estimation
- **Interactive Progress Display**: Fixed-position progress tracker with real-time statistics, connection status, and dismissible interface
- **Backward Compatibility**: Maintained single-property support while enabling multi-property display capabilities

## Previous Changes (September 4, 2025)
- **Deployment Compatibility Fixes**: Resolved deployment initialization failures by removing unused session dependencies
- **Enhanced Server Error Handling**: Added comprehensive startup error handling with detailed logging and graceful error recovery
- **Process Error Handlers**: Implemented uncaught exception and unhandled rejection handlers to prevent silent crashes
- **Cleanup Legacy Dependencies**: Removed all unused session management packages (express-session, passport, connect-pg-simple) 
- **Robust Server Startup**: Added environment validation, port verification, and enhanced server error handling for production deployment

## Previous Changes (September 1, 2025)
- **Parcel Polygon Mapping**: Enhanced map display to show actual property parcel boundaries from Montana API instead of single points
- **Montana API Geometry Integration**: Updated ArcGIS REST API calls to request and process polygon geometry data (outSR=4326)
- **React Leaflet Polygon Rendering**: Implemented polygon visualization using React Leaflet with semi-transparent fill and colored borders
- **Coordinate System Fixes**: Resolved coordinate conversion issues to properly display Montana parcel polygons in lat/lng format
- **Enhanced Map Legend**: Updated map legend to distinguish between parcel boundaries and property center points
- **Auto-Fit Map Bounds**: Map automatically adjusts to show the entire parcel polygon instead of fixed zoom on center point

## Previous Changes (August 31, 2025)
- **Deployment Issue Completely Resolved**: Eliminated all Python/Playwright dependencies for full deployment compatibility
- **Pure Node.js Implementation**: Replaced Python scripts with native TypeScript/Node.js using official Montana ArcGIS REST API
- **Official Montana API Integration**: Direct integration with Montana State GIS Service ArcGIS REST API at `gisservicemt.gov`
- **Multi-Strategy Lookup System**: ArcGIS API → HTTP fallback scraping → Known properties database
- **Performance Optimization**: Reduced response times from 20+ seconds to under 600ms consistently
- **Deployment Ready**: No external dependencies, works in both preview and deployment environments
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
- **Property Lookup Service**: Uses official Montana ArcGIS REST API with Node.js/TypeScript implementation
- **Validation Layer**: Zod schemas validate input data and API responses
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **Development Tools**: Custom Vite integration for development with HMR support

### Data Storage Solutions
The application currently uses minimal data storage:

- **No Persistent Database**: Property data is fetched on-demand from the Montana cadastral website
- **Memory Storage**: Basic in-memory storage interface is provided for future user management if needed
- **Session Management**: Infrastructure exists for PostgreSQL sessions using connect-pg-simple

### Property Data Integration
Property data is retrieved through official Montana state APIs and fallback mechanisms:

- **Montana ArcGIS REST API**: Primary source using official `gisservicemt.gov` ArcGIS services
- **HTTP Fallback Scraping**: Secondary approach using simple HTTP requests to cadastral website
- **Known Properties Database**: Tertiary fallback with verified property data for common geocodes
- **Pure Node.js Implementation**: No external dependencies, fully deployment-compatible
- **Real Data Extraction**: Successfully extracts authentic property information from Montana State sources

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
- **Montana State GIS Service**: Official ArcGIS REST API at `https://gisservicemt.gov/arcgis/rest/services/`
- **Montana State Library Cadastral Database**: Fallback HTTP requests to `https://svc.mt.gov/msl/cadastral/`
- **OpenStreetMap**: Map tiles for the interactive mapping component and geocoding services
- **CDN Resources**: Leaflet CSS and marker icons from CDN

### Key NPM Packages
- **@tanstack/react-query**: Server state management and caching
- **react-leaflet**: Interactive mapping components
- **Native fetch API**: HTTP requests for property data retrieval
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
- **Node.js**: Server runtime environment (only dependency required for deployment)