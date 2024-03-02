const scopes = ['read_all', 'activity:read_all'];
const clientId = '122479';

function getAccessToken() {
    const expiryDate = localStorage.getItem('expiry_date');
    const accessToken = localStorage.getItem('access_token');
    if (accessToken && expiryDate && Date.now() < expiryDate) {
        return localStorage.getItem('access_token');
    } else {
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${window.location.origin + window.location.pathname}&approval_prompt=force&scope=${scopes.join(',')}`;
    }
}

let firstAttempt = true;

function fetchActivities(callback, finalCallback) {
    function internal(page = 1) {
        return fetch(`https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=200`, {
            headers: {
                'Authorization': 'Bearer ' + getAccessToken()
            }
        })
            .then(response => {
                if (response.status !== 200) {
                    throw response;
                } else {
                    return response.json();
                }
            })
            .then(data => {
                if (data.length > 0) {
                    internal(page + 1);
                    data.forEach(callback);
                    finalCallback();
                }
            })
            .catch(error => {
                if (error.status === 401 && firstAttempt) {
                    firstAttempt = false;
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('expiry_date');
                    return internal(page, activities);
                } else {
                    throw error;
                }
            });
    }

    internal();
}

function showActivities() {
    const map = L.map('map');
    const group = L.featureGroup().addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    fetchActivities(
        activity => {
            if (activity.type === 'Ride') {
                const polyline = activity.map.summary_polyline;
                if (polyline) {
                    const decoded = L.Polyline.fromEncoded(polyline).getLatLngs();
                    L.polyline(decoded).addTo(group);
                }
            }
        },
        () => map.fitBounds(group.getBounds()));
}

if (window.location.search !== '') {
    const urlParams = new URLSearchParams(window.location.search);
    const grantedScopes = urlParams.get('scope').split(',');
    if (!scopes.every(scope => grantedScopes.includes(scope))) {
        console.error('The user did not grant all the required scopes.');

    } else {
        const code = urlParams.get('code');

        fetch(`https://strava-token-exchanger.12v.workers.dev/${code}`, {
            mode: 'cors',
        })
            .then(response => response.json())
            .then(data => {
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('expiry_date', data.expires_at * 1000);
                window.location.href = window.location.origin + window.location.pathname;
            })
    }
} else {
    showActivities();
}
