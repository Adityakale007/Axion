function normalizeDevServerUrl(url) {
    if (!url) return url;
    if (url.includes('localhost:5000')) return url.replace('localhost:5000', '127.0.0.1:5000');
    return url;
}

export function getAnalysisApiBases() {
    const envServerUrl = (import.meta.env.VITE_SERVER_URL || '').trim();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname);

    const bases = [];

    if (isLocalHost) {
        if (!envServerUrl) {
            bases.push(`${window.location.protocol}//127.0.0.1:5000`);
        } else {
            bases.push(normalizeDevServerUrl(envServerUrl));
        }
    } else {
        bases.push(currentOrigin);
        if (envServerUrl) {
            bases.push(envServerUrl);
        }
    }

    return [...new Set(bases.filter(Boolean))];
}
