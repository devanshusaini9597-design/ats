// Local-only in dev: when you run `npm run dev`, we ALWAYS use localhost so you test against your local backend.
// Production build uses VITE_API_URL or the live backend.
const API_URL = import.meta.env.DEV
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL || 'https://skillnix-backend.onrender.com');

export default API_URL;
export const BASE_API_URL = API_URL;
