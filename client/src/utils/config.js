// Address of the Express backend (server/). Change the port here if you change the PORT in config.env.
// Uses the same computer as the website: "localhost" on your own laptop, or the host's IP address
// when a teammate opens your site over the network (e.g. http://192.168.1.5:5173 -> server at 192.168.1.5:8000).
export const API_URL = `http://${window.location.hostname || 'localhost'}:8000`
