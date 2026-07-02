const AUTH_TOKEN_KEY = 'forkspace_auth_token';
const AUTH_CHANGE_EVENT = 'forkspace-auth-change';

function notifyAuthChange() {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

export function getAuthToken() {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setAuthToken(token) {
    if (!token) {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        notifyAuthChange();
        return;
    }

    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    notifyAuthChange();
}

export function clearAuthToken() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    notifyAuthChange();
}

export function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export function onAuthChange(listener) {
    window.addEventListener(AUTH_CHANGE_EVENT, listener);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, listener);
}
