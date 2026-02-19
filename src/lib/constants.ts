/**
 * Application-wide constants
 */

// Timing constants (in milliseconds)
export const DEBOUNCE_DELAY_MS = 300;
export const LOCATION_FOUND_DISPLAY_MS = 3000;
export const TYPING_DELAY_MIN_MS = 800;
export const TYPING_DELAY_MAX_MS = 1500;
export const GEOLOCATION_TIMEOUT_MS = 10000;

// Search and location constants
export const SEARCH_RADIUS_KM = 0.5;
export const EXPANDED_SEARCH_RADIUS_KM = 2;
export const MIN_SEARCH_QUERY_LENGTH = 2;
export const MIN_ADDRESS_QUERY_LENGTH = 3;

// Pagination and limits
export const MAX_SEARCH_RESULTS = 5;
export const MAX_ADDRESS_RESULTS = 3;
export const MAX_ROUTE_RESULTS = 3;

// Map defaults
export const DAVAO_CENTER: [number, number] = [7.0731, 125.6128];
export const DEFAULT_MAP_ZOOM = 13;

// Transfer time estimate (in minutes)
export const TRANSFER_WAIT_TIME_MIN = 5;
